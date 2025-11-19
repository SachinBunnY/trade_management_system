# consumer_insert.py (updated)
import asyncio
import json
import logging
from collections import defaultdict
from datetime import datetime
from typing import Dict, Optional

import asyncpg  # type: ignore
from aiokafka import AIOKafkaConsumer  # type: ignore

from config import (
    DB_CONFIG,
    KAFKA_GROUP_ID_FOR_INSERT,
    KAFKA_TOPIC,
    KAFKA_BOOTSTRAP_SERVER,
    logFunction,
)

# -----------------------------------------------------------------------------
# Configuration toggles
# -----------------------------------------------------------------------------
# If True, n_pl is interpreted as per-lot P&L and you must multiply by lot.
# If False, n_pl is already the total P&L for the trade (no multiplication).
N_PL_IS_PER_LOT = True

# -----------------------------------------------------------------------------
# Globals
# -----------------------------------------------------------------------------
modelWiseProfitDB: Dict[str, float] = defaultdict(float)
modelWiseAllocation: Dict[str, float] = {}          # keys like "<model>_<client_id>"
allocation_by_client: Dict[str, float] = {}        # fallback: total allocation by client
insert_lock = asyncio.Lock()
modelTrades: Dict[str, Dict[str, Dict[str, float]]] = {}  # modelKey -> trade_id -> {lot, n_pl}

# -----------------------------------------------------------------------------
# Helpers: key normalization and allocation lookup
# -----------------------------------------------------------------------------
def normalize_prefix_from_code(s_code_or_modelname: str, is_model_name: bool = False) -> str:
    """
    Return the normalized model prefix used in modelKey.
    If is_model_name == True, treat input as s_model_name (already a model prefix).
    Otherwise treat it as s_code (like 'MS1-XYZ') and extract prefix before dash.
    """
    if not s_code_or_modelname:
        return ""
    if is_model_name:
        prefix = str(s_code_or_modelname).strip()
    else:
        prefix = str(s_code_or_modelname).split("-")[0].strip()

    # legacy mapping used elsewhere in your code
    if prefix in ("AIO", "AIONIFABI"):
        prefix = "MS1"
    return prefix


def make_model_key_from_code(s_code: str, client_id: str) -> str:
    return f"{normalize_prefix_from_code(s_code, is_model_name=False)}_{client_id}"


def make_model_key_from_modelname(s_model_name: str, client_id: str) -> str:
    return f"{normalize_prefix_from_code(s_model_name, is_model_name=True)}_{client_id}"


def lookup_allocation_for_modelkey(modelKey: str) -> float:
    """
    Return allocation for a modelKey. Tries, in order:
      1) exact modelKey in modelWiseAllocation
      2) any allocation for same client_id (sum if multiple rows)
      3) fallback 1 (so no division by zero)
    """
    if not modelKey:
        return 1.0

    # 1) exact match
    alloc = modelWiseAllocation.get(modelKey)
    if alloc is not None and alloc != 0:
        return alloc

    # 2) fallback by client id: find allocations having suffix _<client_id>
    parts = modelKey.rsplit("_", 1)
    client_id = parts[-1] if parts else modelKey
    # use precomputed allocation_by_client if available
    client_alloc = allocation_by_client.get(client_id)
    if client_alloc:
        logging.debug(f"[lookup_allocation] Using allocation_by_client for {client_id} -> {client_alloc}")
        return client_alloc

    # try scanning modelWiseAllocation keys to find any key that endswith _<client_id>
    for k, v in modelWiseAllocation.items():
        if k.endswith(f"_{client_id}") and v:
            logging.debug(f"[lookup_allocation] Found allocation by suffix {k} -> {v} for {modelKey}")
            return v

    # 3) last resort
    logging.debug(f"[lookup_allocation] No allocation found for {modelKey}. Falling back to 1")
    return 1.0


# ------------------------
# DB Utils
# ------------------------
async def connect_db():
    return await asyncpg.connect(**DB_CONFIG)


# ------------------------
# Insert Loop
# ------------------------
last_snapshot: Dict[str, float] = {}


async def insert_loop():
    global last_snapshot
    while True:
        await asyncio.sleep(10)
        async with insert_lock:
            if not modelWiseProfitDB:
                logging.info("[INSERT_LOOP] No data to insert")
                continue
            if modelWiseProfitDB == last_snapshot:
                logging.info("[INSERT_LOOP] No changes since last insert, skipping...")
                continue

            await insert_to_db()
            last_snapshot = dict(modelWiseProfitDB)


async def insert_to_db():
    now = datetime.now()
    currentDate = now.date()
    currentTime = now.time()
    time_key = now.strftime("%H:%M:%S")
    logging.info(f"[insert_to_db] Current data: {dict(modelWiseProfitDB)}")

    db = await connect_db()
    try:
        newObj: dict = {time_key: {}}
        for key, value in modelWiseProfitDB.items():
            try:
                allocation = lookup_allocation_for_modelkey(key) or 1.0
                if allocation == 1.0 and key not in modelWiseAllocation:
                    logging.debug(f"[insert_to_db] Allocation fallback used for {key} -> 1.0")

                returnPercentage = (value / allocation) * 100
                newObj[time_key][key] = {
                    "n_pl": value,
                    "n_return_perc": returnPercentage,
                }
            except Exception as e:
                logging.warning(f"[insert_to_db] Error for key={key}: {e}")

        if not newObj[time_key]:
            logging.info("[insert_to_db] No valid rows to insert")
            return

        query = """
            INSERT INTO tbl_derivative_model_m2m_detail
            (dt_date, dt_time, j_m2m)
            VALUES ($1, $2, $3)
        """
        await db.execute(query, currentDate, currentTime, json.dumps(newObj))
        logging.info(f"[INSERT] Success at {currentTime}, rows={len(newObj[time_key])}")
    except Exception as e:
        logging.error(f"[insert_to_db] Failed to insert: {e}")
    finally:
        await db.close()


# ------------------------
# Kafka Consumer
# ------------------------
async def consume_insert():
    consumer = AIOKafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVER,
        group_id=KAFKA_GROUP_ID_FOR_INSERT,
        enable_auto_commit=True,
        auto_offset_reset="earliest",
    )
    await consumer.start()
    try:
        async for msg in consumer:
            data = json.loads(msg.value.decode("utf-8"))
            if isinstance(data, str):
                data = json.loads(data)

            s_code    = data["data"]["s_code"]
            client_id = data["data"]["s_client_id"]
            operation = data.get("operation", "").upper()
            lot       = data["data"].get("n_lot", 1)
            new_pl    = data["data"].get("n_pl", 0.0)
            trade_id  = f"{data['data'].get('s_main_order_id')}_{s_code}"

            modelKey = make_model_key_from_code(s_code, client_id)

            async with insert_lock:
                if modelKey not in modelTrades:
                    modelTrades[modelKey] = {}

                if operation in ("INSERT", "UPDATE"):
                    modelTrades[modelKey][trade_id] = {"lot": lot, "n_pl": new_pl}
                else:
                    logging.warning(f"Unknown op {operation} for {modelKey}")

                if N_PL_IS_PER_LOT:
                    total_pl = sum(v["lot"] * v["n_pl"] for v in modelTrades[modelKey].values())
                else:
                    total_pl = sum(v["n_pl"] for v in modelTrades[modelKey].values())
                modelWiseProfitDB[modelKey] = total_pl
                logging.info(f"{modelKey} → Total P&L = {total_pl}")

            # logging.info(f"modelTrades::{modelTrades}")
    finally:
        await consumer.stop()






# ------------------------
# Helpers - bootstrap today's trades & allocation
# ------------------------
async def get_model_wise_profit():
    """
    Load all today's trades from DB into modelTrades,
    and compute modelWiseProfitDB totals.
    """
    current_date = datetime.today().date()
    db = await connect_db()
    try:
        rows = await db.fetch("""SELECT 
                s_code,
                s_client_id,
                s_main_order_id,
                n_lot,
                n_pl
            FROM tbl_common_trade_details
            WHERE dt_date = now()::date""")

        modelTrades.clear()
        modelWiseProfitDB.clear()

        for row in rows:
            s_code = row["s_code"]
            client_id = row["s_client_id"]
            lot = row["n_lot"] or 1
            pl = row["n_pl"] or 0.0
            trade_id = f"{row['s_main_order_id']}_{s_code}"

            modelKey = make_model_key_from_code(s_code, client_id)
            if modelKey not in modelTrades:
                modelTrades[modelKey] = {}

            modelTrades[modelKey][trade_id] = {"lot": lot, "n_pl": pl}

        for modelKey, trades in modelTrades.items():
            if N_PL_IS_PER_LOT:
                total_pl = sum(v["lot"] * v["n_pl"] for v in trades.values())
            else:
                total_pl = sum(v["n_pl"] for v in trades.values())
            modelWiseProfitDB[modelKey] = total_pl

        return dict(modelWiseProfitDB)
    finally:
        await db.close()


async def get_model_allocation():
    """
    Loads model allocations. Builds:
      - modelWiseAllocation: keys like "<modelprefix>_<client_id>"
      - allocation_by_client: aggregated allocation per client id (fallback)
    """
    global modelWiseAllocation, allocation_by_client
    db = await connect_db()
    try:
        rows = await db.fetch(
            """
            WITH ranked AS (
                SELECT m.*,
                       row_number() OVER (
                           ORDER BY
                               CASE WHEN dt_date <= now()::date THEN 0 ELSE 1 END,
                               CASE WHEN dt_date <= now()::date THEN dt_date END DESC,
                               CASE WHEN dt_date > now()::date THEN dt_date END ASC
                       ) AS rn
                FROM tbl_model_allocation_details m
            )
            SELECT m.dt_date, m.s_client_id, m.s_model_name, m.n_total_margin
            FROM tbl_model_allocation_details m
            WHERE m.dt_date = (
                SELECT dt_date FROM ranked WHERE rn = 1
            )
            """
        )
        alloc = {}
        by_client = {}
        for row in rows:
            client_id = row["s_client_id"]
            model_name = row["s_model_name"]
            margin = float(row["n_total_margin"] or 0.0)

            # store with normalized model key (so same format as in consumer)
            model_key = make_model_key_from_modelname(model_name, client_id)
            alloc[model_key] = margin

            # also keep raw modelname key to be safe
            alloc[f"{model_name}_{client_id}"] = margin

            # accumulate per-client fallback (sum if multiple model allocations exist)
            by_client[client_id] = by_client.get(client_id, 0.0) + margin

        modelWiseAllocation = alloc
        allocation_by_client = by_client
        return alloc
    finally:
        await db.close()


# ------------------------
# Main
# ------------------------
async def main():
    trade_date = str(datetime.today().date())
    logFunction(trade_date, "consumer_insert")

    global modelWiseProfitDB, modelWiseAllocation, allocation_by_client
    modelWiseAllocation = await get_model_allocation()
    allocation_by_client = allocation_by_client  # populated by get_model_allocation()
    modelWiseProfitDB = await get_model_wise_profit()

    logging.info("[MAIN] Initial Profit DB: %s", dict(modelWiseProfitDB))
    logging.info("[MAIN] Initial Allocation: %s", modelWiseAllocation)
    logging.info("[MAIN] Allocation by client (fallback): %s", allocation_by_client)

    await asyncio.gather(
        consume_insert(),
        insert_loop(),
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
