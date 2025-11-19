import axios from "axios";
import { hostIP, autofireURL } from "./util";
const baseURL = `http://${hostIP}:8000`;


interface SquareOff {
  appOrderID: string;
  clientID: string;
}

export const getSessionToken = async () => {
  try {
    let response: any = await axios.get(`${baseURL}/token/`);
    return response?.data;
  } catch (e: any) {
    console.log(e);
    return "";
  }
};

export const getMaxQtyTill = async () => {
  try {
    let response: any = await axios.get(`${baseURL}/maxQtyTill/`);
    return Object.values(response?.data)[0];
  } catch (e: any) {
    console.log(e);
    return "";
  }
};

export const getStrikeWiseQty = async () => {
  try {
    let response: any = await axios.get(`${baseURL}/strikeWiseQty/`);
    return response?.data;
  } catch (e: any) {
    console.log(e);
    return {};
  }
};

export const getModelWiseProfit = async () => {
  try {
    let response: any = await axios.get(`${baseURL}/model-wise-profit`);
    return response?.data;
  } catch (e: any) {
    console.log(e);
    return {};
  }
};

export const getClientWiseAllocation = async()=>{
  try {
    let response: any = await axios.get(`${baseURL}/model-allocation`);
    return response?.data;
  } catch (e: any) {
    console.log(e);
    return {};
  }
}

export const closeTrade = async (stoplossId: string, token: any) => {
  try {
    let payload: SquareOff = {
      appOrderID: stoplossId,
      clientID: '*****',
    };
    const response: any = await axios.put(`${autofireURL}/orders/cover`,payload,{ headers: { Authorization: token } }
    );
    return response?.data;
  } catch (e: any) {
    console.log(e);
    return { type: "error", description: "Server error" };
  }
};

export const fetchModelM2m = async ()=>{
  try{
    const apiRespo = await axios.get(`${baseURL}/model-m2m`);
    return apiRespo?.data;
  }catch(e:any){
    console.log(e);    
  }
}

// export const orderDetails = async (token: string) => {
//   try {
//     const clientID = "*****";
//     const response = await axios.get(`${autofireURL}/interactive/orders`, {
//       params: { clientID },
//       headers: { Authorization: token },
//     });
//     console.log("respo:", response?.data);
//   } catch (e: any) {
//     console.log(e);
//   }
// };

export const checkApiResponseTime = async ({expiryDate,optionType,strikePrice,}: {expiryDate: string;optionType: string;strikePrice: number;}) => {
  try {
    const exchangeSegment: number = 2;
    const series: string = "OPTIDX";
    const symbol: string = "NIFTY";
    const start = performance.now();

    await axios.get(
      `${autofireURL}/apimarketdata/instruments/instrument/optionSymbol`,{
        params: {
          exchangeSegment,
          series,
          symbol,
          expiryDate,
          optionType,
          strikePrice,
        },
      }
    );

    const end = performance.now();
    const responseTime = end - start;

    if (responseTime > 4000) return "High";
    return "Good";
  } catch (e: any) {
    console.error("API error:", e);
    return "Problem in Api";
  }
};

export const fetchAllCloseTrades = async(currentDate:string)=>{
  try{
    let payload:any = {
      date:currentDate
    }
    let apiRespo:any = await axios.post(`${baseURL}/close-trade/`,payload);
    return apiRespo?.data;
  }catch(error:any){
    console.error("Faile to fetch close trades", error);
    return [];
  }
}

export const modifyStoploss = async(token:any, orderID:any, previousStoploss:any, currentStoploss:any, quantity:any,j_target_stoploss:any)=>{

  let payload = {
    "appOrderID": Number(orderID),
    "modifiedProductType": "CO",
    "modifiedOrderType": "StopLimit",
    "modifiedOrderQuantity": Number(quantity),
    "modifiedDisclosedQuantity": 0,
    "modifiedLimitPrice": Number(previousStoploss),
    "modifiedStopPrice": Number(currentStoploss),
    "modifiedTimeInForce": "DAY",
    "clientID": "*****"
  }
  try{
    let respo:any = await axios.put(`${autofireURL}/interactive/orders`,payload,{headers:{Authorization:token}});
    if(respo?.data?.type === 'success'){
      try{
        let parsedTargetStoploss = typeof j_target_stoploss === 'string'? JSON.parse(j_target_stoploss): j_target_stoploss;

        const currentTime: any = new Date().toTimeString().split(" ")[0];
        parsedTargetStoploss[currentTime] = { "Stoploss": Number(currentStoploss) };

        let newBody: any = {
          ...payload,
          j_target_stoploss: parsedTargetStoploss
        };
        
        await axios.post(`${baseURL}/update-trade`,newBody)
      }catch(e:any){console.log(e)}
    }
    if(respo?.data?.type === 'error'){
      
    }
    return respo?.data;
  }catch(e:any){
    console.error(e)
    return { type: "error", description: "Server error" };
  }
}
