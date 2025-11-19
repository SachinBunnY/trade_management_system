export const hostIP:string = '192.168.29.55';
export const autofireURL:string = 'http://colo.srellp.com:3000';

export const fixedModelOrder = ['OpS-M1', 'OpS-M2', 'OpS-M3', 'OpS-M4', 'OpS-M7', 'OpS-M9', 'OpL-M1', 'OpL-M2'];
export const fixedModelOrderStrangles = ['SS1', 'SS2','ST1']
export const modelName:any = ['MS1','MS2','MS3','MS4','MS7','MS9','AIONIFABI','QIONIFSMI','SS1','SS2','DN1'];
export const longModelName:any = ['ML1', 'ML2'];
export const fixedModelName:any = {
    'All':'All',
    'OpS-M1':'MS1',
    'OpS-M2':'MS2',
    'OpS-M3':'MS3',
    'OpS-M4':'MS4',
    'OpS-M7':'MS7',
    'OpS-M9':'MS9',
    'OpL-M1':'ML1',
    'OpL-M2':'ML2',
    'SS1': 'SS1',
    'SS2': 'SS2',
    'ST1':'ST1'
};

export const displayNameToModelKeys: Record<string, string[]> = {
  'OpS-M1': ['MS1','AIONIFABI'],
  'OpS-M2': ['MS2','QIONIFSMI'],
  'OpS-M3': ['MS3'],
  'OpS-M4': ['MS4'],
  'OpS-M7': ['MS7'],
  'OpS-M9': ['MS9'],
  'OpL-M1': ['ML1'],
  'OpL-M2': ['ML2'],
  'SS1': ['SS1'],
  'SS2': ['SS2'],
  'ST1':['ST1']
};

export const modelActualName = (modelName:string)=>{
    modelName = modelName.split('-')[0];
    let obj:any = {
        'AIONIFABI':'OpS-M1',
        'QIONIFSMI':'Ops-M2',
        'MS1':'OpS-M1',
        'MS2':'OpS-M2',
        'MS3':'OpS-M3',
        'MS4':'OpS-M4',
        'MS7':'OpS-M7',
        'MS9':'OpS-M9',
        'ML1':'OpL-M1',
        'ML2':'OpL-M2',
        'DN1':'ST1'
    }
    return obj[modelName] || modelName;
}

export const prefix_map:{[key:string]:string} = {
    "MS1": "MS1",
    "MS2": "MS2",
    'MS3': 'MS3',
    "MS4": "MS4",
    "MS7": "MS7",
    "MS9": "MS9",
    'SS1': 'SS1',
    'SS2': 'SS2',
    'DN1': 'ST1',
    "ML1": "ML1",
    "ML2": "ML2",
}

export interface TableData {
    dt_date: any;
    s_main_order_id: string;
    s_stoploss_order_id: string;
    n_strike_price: number;
    s_option_type: string;
    n_transaction: number;
    dt_entry_time: string;
    dt_exit_time: string;
    n_exit_price: number;
    n_pl: number;
    s_status: string;
    s_code: string;
    n_lot: number;
    old_n_pl: number;
    j_target_stoploss: any;
    s_cancel_reject_reason: string;
    s_failure_status: boolean;
    first_seen_time: any;
    s_sl_status: string;
    dt_expiry_date: any;
    s_client_id:any
}
  
export const OptionsTableHeaderText: string[] = [
    "",
    "Main ID",
    "SL ID",
    "Option",
    "Qty",
    "Transaction",
    "Open Time",
    "Exit Time",
    "LTP",
    "P/L",
    "SL Price",
    "SL Status",
    "Code",
    "Cancel Reason(SL)",
];

export const generateKey = (trade: TableData) =>
    `${trade.s_code}_${trade.dt_entry_time}_${trade.s_main_order_id}`;


export const hasTradeChanged = (oldTrade: TableData,newTrade: TableData): boolean => {
    return (
      oldTrade?.n_pl !== newTrade.n_pl ||
      oldTrade?.s_status !== newTrade.s_status ||
      oldTrade?.n_exit_price !== newTrade.n_exit_price
    );
};
  
export const findLastStoploss = (rowData:TableData)=>{
    let obj:any;
    try{
        obj = rowData.j_target_stoploss;
    }catch(e){
        obj = {};
        return '';
    }

    if (typeof(obj) ==='string'){
        obj = JSON.parse(rowData.j_target_stoploss)
        if(Object.keys(obj).length==0)
            return ''
    }else{
        return ''
    }
    let st:any    = Object.values(obj);
    let value:any = Number(st[st.length-1]["Stoploss"]);

    let t = 1;
    while((['undefined', undefined].includes(value)||Number.isNaN(value)) && t<=3){
        value = Number(st[st.length-t]["Stoploss"])
        t++;
    }
    return value;
}


export const checkTradeFail = (oldTrade:TableData, newTrade:TableData, brokenTradeThreshold=3)=>{
    const key = generateKey(newTrade);
    if (oldTrade.dt_exit_time === newTrade.dt_exit_time) {
        const firstSeenTime = new Date(oldTrade.first_seen_time || Date.now());
        const elapsedSeconds = (Date.now() - firstSeenTime.getTime()) / 1000;
        
        if (elapsedSeconds >= brokenTradeThreshold) {
            oldTrade = {...oldTrade,s_failure_status: true};
        }
        else{
            if (!oldTrade.first_seen_time) {
                oldTrade = {...oldTrade,first_seen_time: new Date().toISOString()};
            }
        }
    } else {
        oldTrade = {...newTrade,s_failure_status: false,first_seen_time: new Date().toISOString()};
    }
    return oldTrade;
}
export const calculateModelWiseProfit = (formattedData: TableData, rawData: any, prevData: any) => {
    try {
      const modelKey: string = formattedData["s_code"] + '_' + formattedData["s_client_id"];
  
      // Ensure an explicit numeric initial value (0) — don't pre-populate with n_pl * n_lot
      if (!(modelKey in prevData)) prevData[modelKey] = 0;
  
      let prevProfit: number = Number(prevData[modelKey] ?? 0);
  
      if (rawData.operation === "UPDATE") {
        const oldPl = Number(formattedData["old_n_pl"] ?? 0);
        const lot = Number(formattedData["n_lot"] ?? 0);
        const newPl = Number(formattedData["n_pl"] ?? 0);
  
        prevData[modelKey] = prevProfit - lot * oldPl + lot * newPl;
        return prevData;
  
      } else if (rawData.operation === "INSERT") {
        const lot = Number(formattedData["n_lot"] ?? 0);
        const pl = Number(formattedData["n_pl"] ?? 0); // don't coerce 0 -> 1
        prevData[modelKey] = prevProfit + lot * pl;
        return prevData;
      }
      return prevData;
    } catch (e) {
      console.error("Error in calculateModelWiseProfit:", e);
      return prevData;
    }
  };
  

export const calculateModelWiseProfitWTRClient = (modelWiseProfit:any, selectedClientID:any)=>{
    if (selectedClientID === 'All') return modelWiseProfit;
    const result:any = {}
    for(const model in modelWiseProfit){
        const modelData = modelWiseProfit[model];
        const filtered  = Object.fromEntries(Object.entries(modelData).filter(([key])=>key.includes(selectedClientID)));
        result[model]   = filtered;
    }
    return result;
}
  
export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}${month}${year}`;
}

export const hasModelData = (data:any, modelName:any) => {
    if (modelName ==='ST1') modelName = 'DN1';
    if (!data || typeof data !== "object") return false;
    return Object.values(data).some(timeEntry => 
      timeEntry && typeof timeEntry === "object" && 
      Object.keys(timeEntry).some(key => key.startsWith(modelName))
    );
  };
  