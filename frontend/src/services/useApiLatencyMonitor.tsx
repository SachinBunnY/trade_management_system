import { useEffect, useState,useRef } from "react";
import { TableData } from "../services/util";
import { formatDate } from "./util";
import { checkApiResponseTime } from "./apiServices";



export const useApiLatencyMonitor = (tradeList: TableData[]) => {
  const [status, setStatus] = useState<string>("");
  const latestTradeRef = useRef<TableData | null>(null);
  
  useEffect(() => {
    if (tradeList.length > 0) {
      latestTradeRef.current = tradeList[0];
    }
  }, [tradeList]);

  useEffect(() => {
    const checkLatency = async () => {
      const trade = latestTradeRef.current;
      if (!trade) return;
      const result = await checkApiResponseTime({
        expiryDate: formatDate(trade.dt_expiry_date),
        optionType: trade.s_option_type,
        strikePrice: trade.n_strike_price,
      });
      setStatus(result);
    };

    checkLatency(); 

    const intervalId = setInterval(checkLatency, 3 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []); 

  return status;
};