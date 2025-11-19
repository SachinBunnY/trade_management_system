import asyncio, logging
from config import DB_CONFIG, KAFKA_BOOTSTRAP_SERVER, KAFKA_GROUP_ID, KAFKA_TOPIC, find_option_id, getOptionLTP, logFunction,MAX_LIMIT_MISSING_COUNT,MISSING_COUNT
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request # type: ignore
from aiokafka import AIOKafkaConsumer # type: ignore
from ws_manager import ws_manager
from datetime import datetime
import json
from fastapi.middleware.cors import CORSMiddleware # type: ignore
import asyncpg #type:ignore
import pytz
from collections import defaultdict
import time
import requests
import httpx  # type: ignore

last_checked_second = None 
db_pool = None

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for testing, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
connected_clients = set()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        

def deep_json_parse(obj):
    """Recursively parses any JSON-encoded strings in a dict."""
    if isinstance(obj, str):
        try:
            parsed = json.loads(obj)
            return deep_json_parse(parsed) 
        except json.JSONDecodeError:
            return obj
    elif isinstance(obj, dict):
        return {k: deep_json_parse(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [deep_json_parse(i) for i in obj]
    return obj


async def check_api_response_time(expiry_date: str, option_type: str, strike_price: int) -> str:
    try:
        exchange_segment = 2
        series = "OPTIDX"
        symbol = "NIFTY"
        autofire_url = 'http://powertrade.srellp.com:3000'

        start = time.perf_counter()
        async with httpx.AsyncClient(timeout=10) as client: # Use AsyncClient
            response = await client.get( # Await the async call
                f"{autofire_url}/apimarketdata/instruments/instrument/optionSymbol",
                params={
                    "exchangeSegment": exchange_segment,
                    "series": series,
                    "symbol": symbol,
                    "expiryDate": expiry_date,
                    "optionType": option_type,
                    "strikePrice": strike_price,
                },
            )
            response.raise_for_status() 

        end = time.perf_counter()
        response_time = (end - start) * 1000
        logging.info(f"API LATENCY TIME: {response_time:.2f} ms") # Format for readability
        return "success" # Return something meaningful, or just log
    except httpx.RequestError as e: # Catch httpx specific exceptions
        logging.error(f"API request error: {e}", exc_info=True)
        return "error"
    except Exception as e: # Catch any other unexpected errors
        logging.error(f"Unexpected error in check_api_response_time: {e}", exc_info=True)
        return "error"


async def handle_data_missing(message):
    global MISSING_COUNT
    if isinstance(message, bytes):
        message = message.decode('utf-8')
    try:
        outer  = json.loads(message)
        parsed = deep_json_parse(outer)
        parsed_data = parsed.get("data", {})
    except Exception as e:
        logging.error(f"Error parsing message: {e}")
        pass

    if parsed_data:
        # check_api_response_time(parsed_data["dt_expiry_date"], parsed_data["s_option_type"], parsed_data["n_strike_price"])

        option_symbol = find_option_id(parsed_data["dt_expiry_date"], parsed_data["n_strike_price"], parsed_data["s_option_type"])
        today         = parsed_data["dt_date"]
        tz            = pytz.timezone("Asia/Kolkata")
        current_time  = (datetime.now(tz)).strftime("%H:%M:%S")
        data_exists   = await getOptionLTP(option_symbol, today, current_time, db_pool)
        # logging.info(f"DATA EXISTS: {data_exists} || MISSING COUNT:: {MISSING_COUNT}")

        if not data_exists:
            MISSING_COUNT += 1
            if MISSING_COUNT == MAX_LIMIT_MISSING_COUNT:
                MISSING_COUNT = 0
                # logging.info(f"ALERT: Current Time {current_time} | {option_symbol} missed 5 consecutive secs of data!")
                alert = {
                    "type":"missing_data_alert",
                    "option_symbol":option_symbol,
                    "missing_status": True,
                    "timestamp":current_time
                }
                message_str = json.dumps(alert)
                await ws_manager.broadcast(message_str)
        else:
            alert = {
                    "type":"missing_data_alert",
                    "option_symbol":option_symbol,
                    "missing_status": False,
                    "timestamp":current_time
                }
            message_str = json.dumps(alert)
            await ws_manager.broadcast(message_str)
            MISSING_COUNT = 0


async def handle_cdc_message(message:str):
    parsed_data = json.loads(message)
    if parsed_data:
        await ws_manager.broadcast(parsed_data) 
        # logging.info("------------------>> TRADE SEND TO FRONTEND <<----------------")
        # if isinstance(parsed_data, dict) and "data" in parsed_data:
        #     data = parsed_data["data"]
        #     if isinstance(data, str): 
        #         try:
        #             data = json.loads(data)
        #             logging.info(f"CODE: {data.get('s_code')} || MAIN ID: {data.get('s_main_order_id')} || STOPLOSS ID: {data.get('s_stoploss_order_id')}")
        #         except json.JSONDecodeError as e:
        #             logging.error(f"Failed to parse 'data' string as JSON: {e}", exc_info=True)
        #     elif isinstance(data, dict):
        #         logging.info(f"CODE: {data.get('s_code')} || MAIN ID: {data.get('s_main_order_id')} || STOPLOSS ID: {data.get('s_stoploss_order_id')}")
        #     else:
        #         logging.warning(f"Unexpected type for 'data' key: {type(data)}. Expected dict or JSON string.")
        # else:
        #     logging.warning("Expected 'data' key not found in parsed message or message is not a dict.")


async def handle_all(message:str):
    global last_checked_second
    await handle_cdc_message(message)
    
    current_second = int(time.time())
    if current_second != last_checked_second:
        last_checked_second = current_second
        await handle_data_missing(message)
    
    # await saveM2MofModel(message)
       
        
async def kafka_listener():
    logging.info("Starting Kafka listener...")
    consumer = AIOKafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVER,
        group_id=KAFKA_GROUP_ID,
        enable_auto_commit=True,
        auto_offset_reset="latest",  #"earliest", "latest"
        session_timeout_ms=30000,   # default 10s, increase to 30s
        heartbeat_interval_ms=10000,  # must be lower than session_timeout_ms
        max_poll_interval_ms=60000,  # allow 60s processing per batch
    )

    for attempt in range(10):
        try:
            await consumer.start()
            break
        except Exception as e:
            logging.warning(f"[Attempt {attempt+1}] Kafka not ready: {e}")
            await asyncio.sleep(5)
    logging.info(f"Kafka consumer started on {KAFKA_BOOTSTRAP_SERVER}")
    loop = asyncio.get_event_loop()
    try:
        async for msg in consumer:
            message_str = msg.value.decode("utf-8")
            loop.create_task(handle_all(message_str))

    except Exception as e:
        logging.error(f"Kafka listener error: {e}")
    finally:
        await consumer.stop()
        logging.info("Kafka consumer stopped.")


@app.on_event("startup")
async def startup_event():
    global db_pool
    trade_date = str(datetime.today().date())
    # logFunction(trade_date, 'consumer')
    db_pool = await asyncpg.create_pool(**DB_CONFIG)
    logging.info("Database connection pool created.")
    asyncio.create_task(kafka_listener())

@app.on_event("shutdown")
async def shutdown_event():
    if db_pool:
        await db_pool.close()
        logging.info("Database connection pool closed.")

async def connect_db():
    return await asyncpg.connect(**DB_CONFIG)


@app.get("/token")
async def getToken():
    try:
        async with db_pool.acquire() as db_session:
            token_result = await db_session.fetch(f"select s_client_code, s_token from tbl_symphony_user_login_details where dt_date = now()::date;")
            if token_result:
                token_value = {token_row['s_client_code']:token_row['s_token'] for token_row in token_result}
                return token_value
            else:
                return {}
    except Exception as e:
        logging.error(f"Exception error in getToken: {e}", exc_info=True)
        return {}
       
    
@app.get("/strikeWiseQty")
async def getStrikeWiseQty():
    try:
        current_date = datetime.today().date()
        async with db_pool.acquire() as db_session:
            records = await db_session.fetch("select CAST(n_strike_price AS TEXT) || s_option_type AS combined_value,SUM(n_lot) AS total_lot FROM tbl_common_trade_details where dt_date = $1 GROUP BY CAST(n_strike_price AS TEXT) || s_option_type order by total_lot desc;",current_date)
            if records:
                data = {record["combined_value"]:record["total_lot"] for record in records}
                return data
            else:
                return {}
    except Exception as e:
        logging.info(f"Exception error: {e}")
        return {}
    

@app.get("/model-wise-profit")
async def get_model_wise_profit():
    try:
        current_date = datetime.today().date()
        async with db_pool.acquire() as conn:
            query = """
                SELECT 
                    (s_code || '_' || COALESCE(s_client_id, '')) AS model_name,
                    SUM(n_pl * n_lot) AS total_profit
                FROM tbl_common_trade_details
                WHERE dt_date = $1
                GROUP BY model_name
                ORDER BY total_profit DESC;
            """
            records = await conn.fetch(query, current_date)

        if not records:
            return {}

        data = defaultdict(dict)
        for record in records:
            model_name  = record["model_name"]
            base_prefix = model_name.split("-")[0]  
            logging.info(f"base_prefix:{base_prefix}")
            if base_prefix == "AIONIFABI":
                base_prefix = "MS1"
            elif model_name.startswith("AIONIFKKL"):
                base_prefix = "ML1"
            elif model_name.startswith("DN1"):
                base_prefix = "ST1"

            data[base_prefix][model_name] = record["total_profit"]
        return data

    except Exception as e:
        logging.exception(f"Error in get_model_wise_profit: {e}")
        return {}



@app.post("/close-trade")
async def fetchAllCloseTrade(request:Request):
    try:
        data = await request.json()
        currentDate_str = data["date"] 
        currentDate_obj = datetime.strptime(currentDate_str, '%Y-%m-%d').date()

        async with db_pool.acquire() as db_session:
            records = await db_session.fetch(
                "SELECT * FROM tbl_common_trade_details WHERE dt_date = $1 ORDER BY dt_entry_time DESC;",
                currentDate_obj
            )
            if records:
                result = [dict(record) for record in records ]
                return result
            return []
    except Exception as error:
        logging.error(f"Exception error in fetchAllCloseTrade: {error}", exc_info=True)
        return []
    
 
@app.get("/maxQtyTill")
async def getMaxQtyTill():
    try:
        current_date = datetime.today().date()
        async with db_pool.acquire() as db_session:
            result = await db_session.fetch("select n_maxqty_till from tbl_common_trade_required_data where dt_date = $1;",current_date)
            if result:
                value = result[0]["n_maxqty_till"]
                return {"data": value}
            else:
                return {"error": "0"}
    except Exception as e:
        logging.info(f"Exception error: {e}")
        return {"error": "0"}
    
    
@app.post("/update-trade")
async def updateTrade(request:Request):
    try:
        body = await request.json()
        async with db_pool.acquire() as db_session:
            await db_session.execute(
                "UPDATE tbl_common_trade_details SET j_target_stoploss = $1 WHERE s_stoploss_order_id = $2 AND dt_date=now()::date;",
                body['j_target_stoploss'], 
                body['appOrderID']
            )
            return {"status": "success", "message": "Trade updated successfully"}
    except Exception as e:
        logging.error(f"Exception error in updateTrade: {e}", exc_info=True)
        return {"status": "error", "message": str(e)} 
    

@app.get('/model-allocation')
async def modelAllocation():
    try:
        clientWiseAllocation = {}
        async with db_pool.acquire() as db_session:
            rows = await db_session.fetch('''with ranked as (select
                                                        m.*,
                                                        row_number() over (
                                                    order by
                                                        case when dt_date <= now()::date then 0 else 1 end,
                                                        case when dt_date <= now()::date then dt_date end desc,
                                                        case when dt_date > now()::date then dt_date end asc ) as rn
                                                    from
                                                        tbl_model_allocation_details m)
                                                    select
                                                    m.dt_date, m.s_client_id, m.s_model_name, m.n_total_margin
                                                    from
                                                        tbl_model_allocation_details m
                                                    where
                                                        m.dt_date = (
                                                        select
                                                            dt_date
                                                        from
                                                            ranked
                                                        where
                                                            rn = 1);''')
            
            for row in rows:
                if row['s_client_id'] not in clientWiseAllocation:
                    clientWiseAllocation[row['s_client_id']] = {}

                if row['s_model_name'] not in clientWiseAllocation[row['s_client_id']]:
                    clientWiseAllocation[row['s_client_id']][row['s_model_name']] = {}

                clientWiseAllocation[row['s_client_id']][row['s_model_name']] = row['n_total_margin']
            
            return clientWiseAllocation
    except Exception as e:
        logging.info(f"Exception error: {e}")



@app.get('/model-m2m')
async def fetchModelM2M():
    try:
        async with db_pool.acquire() as db_session:
            rows = await db_session.fetch('''select
                                        j_m2m
                                    from
                                        tbl_derivative_model_m2m_detail
                                    where dt_date = now()::date
                                    order by dt_time asc;''')
            result = {}

            for record in rows:
                raw = record.get("j_m2m")
                if not raw:
                    continue

                parsed = json.loads(raw)  
                for time_key, models in parsed.items():
                    if time_key not in result:
                        result[time_key] = {}
                    result[time_key].update(models) 
            
            return result
    except Exception as e:
        logging.info(f"Exception error: {e}")
        





















# def check_api_response_time(expiry_date: str, option_type: str, strike_price: int) -> str:
#     try:
#         exchange_segment = 2
#         series = "OPTIDX"
#         symbol = "NIFTY"
#         autofire_url = 'http://powertrade.srellp.com:3000'

#         start = time.perf_counter()

#         response = requests.get(
#             f"{autofire_url}/apimarketdata/instruments/instrument/optionSymbol",
#             params={
#                 "exchangeSegment": exchange_segment,
#                 "series": series,
#                 "symbol": symbol,
#                 "expiryDate": expiry_date,
#                 "optionType": option_type,
#                 "strikePrice": strike_price,
#             },
#             timeout=10  
#         )

#         end = time.perf_counter()
#         response_time = (end - start) * 1000  
#         logging.info(f"API LATENCY TIME:   {response_time}")
    
#     except requests.RequestException as e:
#         logging.info(f"API error: {e}")
#         pass





