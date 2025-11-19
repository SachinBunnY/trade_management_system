import React,{useEffect, useState} from "react";
import { TableData } from "../services/util";
import { fetchAllCloseTrades } from "./apiServices";

export const MARKET_CLOSE_HOUR:number = 15;
export const CLOSE_HOUR:number = 14;
export const MARKET_CLOSE_MINUTE:number = 29;


export const callApiOnceAfterMarketClose = async () => {
    try {
        const now:any = new Date();
        const currentDate:any = now.toISOString().split('T')[0];
        const apiCalled = localStorage.getItem("afterMarketApiCalled")||"false";
        if (apiCalled==="false" && now.getHours() >= MARKET_CLOSE_HOUR && now.getMinutes() >= MARKET_CLOSE_MINUTE) {
            const allTrades = await fetchAllCloseTrades(currentDate);
            localStorage.setItem("afterMarketApiCalled", "true");
            return allTrades;
        }
        return [];
    } catch (error) {
        console.error("After market api failed", error);
        return [];
    }
};
   

export const useMarketCloseApiTrigger = ()=>{
    const [allCloseTrades, setAllCloseTrade] = useState<TableData[]>([]);
    useEffect(() => {
        const intervalId = setInterval(async () => {
            const data = await callApiOnceAfterMarketClose();
            if (data.length > 0) {
                setAllCloseTrade(data);
            }
        }, 60 * 1000); 
    
        return () => clearInterval(intervalId);
    }, []);
    
    return allCloseTrades;
}
