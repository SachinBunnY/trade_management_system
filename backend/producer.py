import asyncio, re, asyncpg, json, logging #type: ignore
from datetime import datetime 
from tabulate import tabulate #type: ignore
from aiokafka import AIOKafkaProducer #type: ignore
from config import DB_CONFIG, KAFKA_BOOTSTRAP_SERVER, KAFKA_TOPIC, logFunction,ordered_fields,old_ordered_fields


async def connect_db():
    return await asyncpg.connect(**DB_CONFIG)

async def create_producer():
    return AIOKafkaProducer(
        bootstrap_servers = KAFKA_BOOTSTRAP_SERVER,
        value_serializer = lambda v:json.dumps(v).encode("utf-8"),
    )

async def wait_for_kafka_bootstrap(producer):
    for attempt in range(10):
        try:
            await producer.start()
            return
        except Exception as e:
            logging.warning(f"[Attempt {attempt + 1}] Kafka not ready yet: {e}")
            await asyncio.sleep(3)
    raise RuntimeError("Kafka did not become ready in time")


def parse_cdc_update(raw_data: str):
    try:
        old_key_match = re.search(r"old-key:(.*)", raw_data)
        new_tuple_match = re.search(r"new-tuple:(.*)", raw_data)
        if not new_tuple_match:
            new_tuple_match = re.search(r"INSERT:\s*(.*)", raw_data)

        result = {}
        if new_tuple_match:
            new_tuple_str = new_tuple_match.group(1)
            for field in ordered_fields:
                pattern = rf"{field}\[[^\]]+\]:(?:'([^']*)'|(null)|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?))"
                match = re.search(pattern, new_tuple_str)
                if match:
                    str_val, null_val, num_val = match.groups()
                    if null_val is not None:
                        result[field] = ""
                    elif str_val is not None:
                        result[field] = str_val
                    elif num_val is not None:
                        try:
                            result[field] = float(num_val) if '.' in num_val or 'e' in num_val.lower() else int(num_val)
                        except:
                            result[field] = num_val
                else:
                    logging.warning(f"[MISSING] {field} not found")
                    result[field] = ""

        if old_key_match:
            old_key_str = old_key_match.group(1)
            for field in old_ordered_fields:
                pattern = rf"{field}\[[^\]]+\]:(?:'([^']*)'|(null)|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?))"
                match = re.search(pattern, old_key_str)
                if match:
                    str_val, null_val, num_val = match.groups()
                    if null_val is not None:
                        result["old_" + field] = ""
                    elif str_val is not None:
                        result["old_" + field] = str_val
                    elif num_val is not None:
                        try:
                            result["old_" + field] = float(num_val) if '.' in num_val or 'e' in num_val.lower() else int(num_val)
                        except:
                            result["old_" + field] = num_val
                else:
                    result["old_" + field] = ""
        return result

    except Exception as e:
        logging.error(f"Exception during CDC parse: {e}")
        return {}



async def fetch_cdc_changes():
    conn     = None 
    producer = None 
    try:
        conn     = await connect_db()
        producer = await create_producer()
        await wait_for_kafka_bootstrap(producer)
        logging.info(f"--------->> !! Kafka producer started on {KAFKA_BOOTSTRAP_SERVER} !! <<-----------")

        while True:
            # logging.info(f"Checking for CDC changes...")
            try:
                changes = await conn.fetch("SELECT * FROM pg_logical_slot_get_changes('flask_cdc_slot', NULL, NULL)")
                if not changes:
                    await asyncio.sleep(1)
                    continue

                for change in changes:
                    raw_data = change['data']
                    table_match = re.search(r"table\s+(\S+):\s*(\w+)", raw_data)
                    if not table_match:
                        # logging.warning(f"No table match found in raw data: {raw_data}") # Add more specific logging
                        continue

                    table_name = table_match.group(1)
                    operation  = table_match.group(2)
                    if table_name == 'public.tbl_common_trade_details':
                        try:
                            fields = parse_cdc_update(raw_data)
                            if fields:
                                message = {
                                    "lsn":change["lsn"],
                                    "xid":change["xid"],
                                    "data": fields,
                                    "table_name": table_name,
                                    "operation": operation
                                }

                                await producer.send_and_wait(KAFKA_TOPIC, json.dumps(message)) # Ensure message is bytes
                                logging.info("------------------>> TRADE SEND SUCCESSFULLY <<----------------")
                            else:
                                logging.warning(f"Parsed fields are empty for data: {raw_data}")
                        except Exception as inner_error:
                            logging.error(f"Error processing CDC message for table {table_name}: {inner_error}", exc_info=True)
                    else:
                        logging.debug(f"Skipping CDC for table: {table_name}") 
                # await asyncio.sleep(1) # Sleep after processing all changes in an iteration
            except asyncpg.exceptions.PostgresError as pg_err:
                logging.error(f"PostgreSQL error during CDC fetch: {pg_err}", exc_info=True)
                await asyncio.sleep(2) 
            except Exception as loop_e:
                logging.error(f"Unhandled exception within main CDC loop: {loop_e}", exc_info=True)
                await asyncio.sleep(2)
                break 
    except Exception as startup_e:
        logging.error(f"Critical startup or main loop error: {startup_e}", exc_info=True)
    finally:
        if producer:
            await producer.stop()
            logging.info(f"Kafka producer stopped.")
        if conn:
            await conn.close()
            logging.info(f"DB connection closed.")


if __name__ == "__main__":
    trade_date = str(datetime.today().date())
    # logFunction(trade_date, 'producer')
    asyncio.run(fetch_cdc_changes())









