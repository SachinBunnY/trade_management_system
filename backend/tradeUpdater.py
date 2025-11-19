import json
import logging
import requests
import pandas as pd
from env_varibles import url_path
from colorama import Fore, Style
import numpy as np 
from datetime import datetime
from db_conn import getConnection85
import os

path = '/home/vista-ai/Pictures/TradeFile Generator/'


def getToken(current_date, clientCode):
    try:
        query = f'''select
                        s_token
                    from
                        tbl_symphony_user_login_details
                    where
                        dt_date = '{current_date}'
                        and s_client_code = '{clientCode}';'''
        with getConnection85() as conn:
            response = pd.read_sql(query, conn)
            token    = response['s_token'].values[0]
            logging.info(f"Session token: {token}")
            return token
    except Exception as e:
        logging.info(f"Exception error when try to get token. error: {str(e)}")
        pass


def orderBook(clientId, date):
    """Fetch order book data from API."""
    token = getToken(date, clientId)
    params = {"clientID": clientId}
    headers = {'authorization': token}    
    try:
        response = requests.get(f"{url_path}/interactive/orders", params=params, headers=headers)
        if response.status_code == 200:
            api_response = response.json()
            if api_response.get('type') == 'success':
                logging.info("Order book data fetched successfully")
                return api_response['result']
        logging.info(f"{response.status_code} - Order Not Sent to Exchange, Response -> {response.text}")
    except Exception as error:
        logging.info(f"Exception occurred while fetching order book, error -> {error}")
    return None


def updateCloseTrades(tradesData, date):
    db_session = getConnection85()
    for trade in tradesData.itertuples(index=True, name='Pandas'):
        main_order_id     = trade.MainAppOrderID
        stoploss_order_id = trade.StoplossAppOrderID
        s_client_id       = trade.ClientID
        splitData         = False

        try:
            identifier        = trade.OrderUniqueIdentifier.split('_')
            if 'OSM4' in identifier[0]:
                entry_time = identifier[1][0:2]+':'+identifier[1][2:4]+':'+identifier[1][-2:]
            else:
                entry_time        = identifier[1]
                
            splitData         = True
        except:
            if 'ML1' in trade.OrderUniqueIdentifier:
                arr               = trade.OrderUniqueIdentifier.split("-")
                identifier        = arr[0]
                entry_time        = arr[1][0:2]+':'+arr[1][2:4]+':'+arr[1][-2:]
            else:
                identifier        = trade.OrderUniqueIdentifier[:6]
                entry_time        = trade.OrderUniqueIdentifier[-6:][0:2]+':'+trade.OrderUniqueIdentifier[-6:][2:4]+':'+trade.OrderUniqueIdentifier[-2:]

        entry_price       = trade.OriginalExecutionPrice
        exit_time         = trade.LastUpdateDateTime[-8:]
        quantity          = trade.CumulativeQuantity
        cancelReason      = trade.CancelRejectReason
        tradingSymbol     = trade.TradingSymbol.split(" ")
        strike_price      = tradingSymbol[1]
        option_type       = tradingSymbol[0]

        if splitData:
            identifier = identifier[0]
        
        if 'AIODDI' in identifier:
            splitTime = entry_time.split(":")
            code          = 'M3-'+ splitTime[0]+splitTime[1]+splitTime[2] 
        elif 'MS4' in identifier:
            splitTime = entry_time.split(":")
            code          = 'MS4-'+ splitTime[0]+splitTime[1]+splitTime[2]  
        elif 'ML1' in identifier:
            splitTime = entry_time.split(":")
            code          = 'ML1-'+ splitTime[0]+splitTime[1]+splitTime[2]      
        elif 'QIOSMI' in identifier:
            code          = 'QIONIFSMI-'+identifier[-2:] 
        elif 'AIOKKS' in identifier:
            splitTime = entry_time.split(":")
            code      = 'AIONIFKKS'+'-'+splitTime[0]+splitTime[1]+splitTime[2] 
        elif 'OSM4' in identifier:
            code      = 'AIONIFKKL4'
        elif 'AIONIFABI' in identifier:
            splitTime = entry_time.split(":")
            code      = 'AIONIFABI'+'-'+splitTime[1]+'_'+splitTime[2] 
        else:
            code          = identifier

        if "L" in code:
            exit_price = trade.OrderAverageTradedPrice
            n_pl = trade.pl
            n_return = ((float(trade.pl) * float(trade.CumulativeQuantity)) /
                        (float(trade.OriginalExecutionPrice) * float(trade.CumulativeQuantity))) * 100
        else:
            exit_price = trade.OrderAverageTradedPrice
            n_pl = trade.pl
            n_return = (float(trade.pl * trade.CumulativeQuantity) / float(220000)) * 100

        logging.info(f"IDENTIFIER: {identifier} || CODE: {code} || ENTRY: {entry_time} || EXIT: {exit_time}")
        
        try:
            query = '''
                UPDATE tbl_common_trade_details
                SET n_exit_price = %s, n_pl = %s, n_return = %s, dt_exit_time = %s
                WHERE dt_date = %s AND s_main_order_id = '%s';
            '''
            value = (exit_price, n_pl, n_return, exit_time, date, main_order_id)

            curr = db_session.cursor()
            curr.execute(query, value)

            if curr.rowcount == 0:
                logging.info(f"No matching trade found for MainOrderID: {main_order_id}")
                try:
                    query = '''insert into tbl_common_trade_details (dt_date,
                        s_code, dt_entry_time, n_transaction, dt_exit_time, n_exit_price,
                        s_main_order_id, s_stoploss_order_id, s_cancel_reject_reason, n_lot,
                        n_pl,n_return,j_target_stoploss,s_trade_type,n_strike_price,s_option_type,s_status,s_client_id)
                        values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s);'''
                    
                    value=(date,code,entry_time,entry_price,exit_time,exit_price,main_order_id,
                            stoploss_order_id,cancelReason,quantity,n_pl,n_return,json.dumps({}),
                            'Short',strike_price,option_type,'Others',s_client_id)
                    
                    curr = db_session.cursor()
                    curr.execute(query, value)
                    logging.info(f"\n ---------------->> New trade inserted into database for {code} and Main Id: {main_order_id} \n")
                except Exception as e:
                    logging.info(f"Exception error when try to insert new trade >> {str(e)}")
            else:
                db_session.commit()
                logging.info(f"Updated into database for {code} and Main Id: {main_order_id}\n")

        except Exception as e:
            logging.info(f"Exception occurred for MainOrderID: {main_order_id} -> {e}")
            db_session.rollback()

    db_session.close()



def find_pl_co(client_id, date):
    logging.info("\n\n\n\n")
    logging.info(f'#---------------------------------------------------------------#')
    logging.info(f'#              STARTED FETCHING DETAILS FOR COVER ORDER           #')
    logging.info(f'#---------------------------------------------------------------#')
    order_book = orderBook(client_id, date)
    if not order_book:
        logging.info("No order book data available.")
        return

    main_orders = []    
    for order in order_book:
        if order['ProductType'] == 'CO' and  order['OrderType'] == 'Market' and order['OrderStatus'] != 'Rejected':  
            main_orders.append({
                "AppOrderID": order['AppOrderID'],
                "OrderAverageTradedPrice": order['OrderAverageTradedPrice'], 
                "OrderUniqueIdentifier": order['OrderUniqueIdentifier'],
                "CumulativeQuantity": order['CumulativeQuantity'],
                "TradingSymbol" : order['TradingSymbol'][-8:],
                "ClientID" : order['ClientID'],
                "LastUpdateDateTime": order['LastUpdateDateTime'],
                "CancelRejectReason":order['CancelRejectReason']
            })

    sorted_main = pd.DataFrame(main_orders)
    if len(sorted_main) > 0:
        sorted_main.sort_values(by=['OrderUniqueIdentifier'], ascending=True, inplace=True)
        order_book_history = pd.DataFrame(columns=["MainAppOrderID","TradingSymbol","OriginalExecutionPrice","OrderUniqueIdentifier","OrderGeneratedDateTime","StoplossAppOrderID","OrderAverageTradedPrice","CumulativeQuantity","ClientID","LastUpdateDateTime","CancelRejectReason"])    

        for order in main_orders:
            for trade in order_book:
                if (trade['OrderUniqueIdentifier'] == order['OrderUniqueIdentifier']) and (trade['OrderStatus'] == 'Filled')  and (trade['ProductType'] == 'CO') and ((int(trade['AppOrderID']) ==  (int(order['AppOrderID'])) + 1 )):                     
                    order_book_history = pd.concat([order_book_history, pd.DataFrame([{
                        "MainAppOrderID": order['AppOrderID'],
                        "TradingSymbol" : order['TradingSymbol'][-8:],
                        "OriginalExecutionPrice": order['OrderAverageTradedPrice'],
                        "OrderUniqueIdentifier": order['OrderUniqueIdentifier'],
                        "OrderGeneratedDateTime": trade['OrderGeneratedDateTime'],
                        "StoplossAppOrderID": trade['AppOrderID'],
                        "OrderAverageTradedPrice": trade['OrderAverageTradedPrice'],
                        "CumulativeQuantity": trade['CumulativeQuantity'],
                        "ClientID" : order['ClientID'],
                        "LastUpdateDateTime": trade['LastUpdateDateTime'],
                        "CancelRejectReason":order['CancelRejectReason']
                    }])], ignore_index=True)
 
        if order_book_history.empty:
            logging.info("No filled trades found.")
            return None,None

        order_book_history['pl'] = np.where(
            order_book_history['OrderUniqueIdentifier'].str.contains("L", na=False),
            order_book_history['OrderAverageTradedPrice'].astype(float) - order_book_history['OriginalExecutionPrice'].astype(float),   
            order_book_history['OriginalExecutionPrice'].astype(float) - order_book_history['OrderAverageTradedPrice'].astype(float)
        )

        order_book_history.sort_values(by=['OrderUniqueIdentifier'], ascending=True, inplace=True)
        order_book_history.drop_duplicates(subset=['MainAppOrderID', 'StoplossAppOrderID', 'OrderUniqueIdentifier'], inplace=True)
        # order_book_history.to_csv(f"Trade_results_{str(pd.to_datetime('today').date())}_{client_id}_CO.csv")
        updateCloseTrades(order_book_history, date)
  

def logFunction(trade_date):
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)

    log_file = f"{path}logs/{trade_date}.log"
    handler = logging.FileHandler(log_file, mode='w')
    formatter = logging.Formatter('At %(asctime)s - %(message)s')
    handler.setFormatter(formatter)

    if logger.hasHandlers():
        logger.handlers.clear()
    logger.addHandler(handler)

    logger.info(f""" --------------->> TRADE SESSION START FOR {trade_date} <<---------------------""")


clientId = ['CLI14404','CLI15223','CLI15224','CLI6987']
trade_date = str(datetime.today().date())
# logFunction(trade_date)
for id in clientId:
    try:
        find_pl_co(id, trade_date)
    except Exception as e:
        logging.info(e)