import logging
import os
from datetime import datetime
import pytz
from warnings import filterwarnings
filterwarnings('ignore')

path = os.path.dirname(__file__)


DB_CONFIG = {
    "database":"postgres",
    "user":"postgres",
    "password":"Server@Db@123",
    "host":"192.168.29.85",
    "port":5432,
    
}

CDC_SLOT_NAME = "flask_cdc_slot"
KAFKA_BOOTSTRAP_SERVER = "kafka:9092"
KAFKA_TOPIC = 'cdc-updates'
KAFKA_GROUP_ID = "cdc-consumer-group"
KAFKA_GROUP_ID_FOR_INSERT = "cdc-consumer-insert-group"
MISSING_COUNT = 0
MAX_LIMIT_MISSING_COUNT = 5


ordered_fields = [
    "dt_date",
    "dt_entry_time",
    "s_code",
    "dt_exit_time",
    "j_target_stoploss",
    "n_transaction",
    "s_trade_type",
    "n_strike_price",
    "s_option_type",
    "n_exit_price",
    "n_lot",
    "n_pl",
    "s_status",
    "s_main_order_id",
    "s_stoploss_order_id",
    "s_cancel_reject_reason",
    "s_sl_status",
    "dt_expiry_date",
    "s_client_id",
    "s_instrument_token",
    "s_identifier"
]

old_ordered_fields = [
    "n_pl"
]



class TZFormatter(logging.Formatter):
    def __init__(self, fmt = None, tz=None):
        super().__init__(fmt)
        self.tz = pytz.timezone(tz or 'UTC')

    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, self.tz)
        if datefmt:
            return dt.strftime(datefmt)
        else:
            return dt.isoformat()
        
        
def logFunction(trade_date, code):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    log_dir = os.path.join(os.getcwd(), "logs")
    os.makedirs(log_dir, exist_ok=True)

    log_file = os.path.join(log_dir, f"{trade_date}_{code}.log")
    formatter = TZFormatter('At %(asctime)s - %(message)s', tz='Asia/Kolkata') 

    file_handler = logging.FileHandler(log_file, mode='w')
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(logging.Formatter('[%(levelname)s] %(message)s'))

    if logger.hasHandlers():
        logger.handlers.clear()

    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)

    logger.info("--------------->> TRADE UPDATER LOGS <<---------------")




def covert_date_format(date) :
    input_date_string     = date
    date_object           = datetime.strptime(input_date_string, "%Y-%m-%d")
    formatted_date_string = date_object.strftime("%d%b%y").upper()
    return formatted_date_string

def find_option_id(exipy_date,strike,option_type) :
    return 'NIFTY'+ covert_date_format(exipy_date)+str(strike)+option_type+'.NFO'



async def getOptionLTP(option_id, date, current_time, db_pool):
    get_option_ltp = """SELECT
                        s_symbol,
                        dt_date,
                        dt_time,
                        n_ltp
                    FROM
                        tbl_nfo_second_live
                    WHERE
                        s_symbol = $1
                        AND dt_date = $2
                        AND dt_time = $3;"""
    try:
        if isinstance(date, str):
            date = datetime.strptime(date, "%Y-%m-%d").date()
        if isinstance(current_time, str):
            current_time = datetime.strptime(current_time, "%H:%M:%S").time()
        async with db_pool.acquire() as db_session:
            response = await db_session.fetch(get_option_ltp, option_id, date, current_time)
            if not response:
                # logging.info(f"No LTP data found for symbol: {option_id}, date: {date}, time: {current_time}")
                return False
            else:
                # logging.info(f"LTP data found for symbol: {option_id}, date: {date}, time: {current_time}. Result: {response[0]['n_ltp']}")
                return True   
    except Exception as error:
        logging.error(f"Error in the function getOptionLTP for {option_id}: {error}", exc_info=True)
        return False
    

