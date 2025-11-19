import React, { useCallback, useEffect, useRef, useState } from "react";
import "./HomePage.css";
import useWebSocket from "../services/WebSockets";
import useInternetStatus from "../services/useInternetStatus";
import {calculateModelWiseProfit,calculateModelWiseProfitWTRClient,displayNameToModelKeys,fixedModelName,fixedModelOrder,generateKey,hasTradeChanged,prefix_map,hasModelData, fixedModelOrderStrangles} from "../services/util";
import { Modal } from "./Modal";
import {fetchModelM2m, getClientWiseAllocation, getModelWiseProfit,getSessionToken,} from "../services/apiServices";
import { Tooltips } from "./Tooltips";
import { useApiLatencyMonitor } from "../services/useApiLatencyMonitor";
import { MARKET_CLOSE_HOUR,CLOSE_HOUR, MARKET_CLOSE_MINUTE, useMarketCloseApiTrigger } from "../services/useMarketCloseApiTrigger";
import { TableData} from "../services/util";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../app/store";
import {setTradeList, setSessionToken, setIsLoader, setModelAllocation, setTotalMarginAllocated } from "../features/trade/tradeSlice";
import { TradesTable } from "./TradesTable";
import { ModelPLComponent } from "./ModelPLComponent";
import StrikeWiseQty from "./StrikeWiseQty";
import AreaChart from "./AreaChart";
import { Swiper, SwiperSlide } from 'swiper/react';
import { motion } from "framer-motion";

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
// import required modules
import { Pagination, Navigation } from 'swiper/modules';
import AreaChartModelWise from "./AreaChartModelWise";


const now:any = new Date();


export const HomePage = () => {
  const isOnline        = useInternetStatus();
  const allCloseTrades  = useMarketCloseApiTrigger();

  const tradeMapRef     = useRef<{ [key: string]: TableData }>({});
  const modelWiseProfit = useRef<{ [key: string]: any }>({});
  let totalProfit       = useRef<any>(0);

  const dispatch = useDispatch();
  const tradeList         = useSelector((state:RootState)=>state.trade.tradeList);
  const isModalOpen       = useSelector((state:RootState)=>state.trade.isModelOpen);
  const squareOffResponse = useSelector((state:RootState)=>state.trade.squareOffResponse);
  const slModifyResponse  = useSelector((state:RootState)=>state.trade.slModifyResponse);
  const selectedClientID  = useSelector((state:RootState)=>state.trade.selectedClientId);
  const selectedModelName = useSelector((state:RootState)=>state.trade.selectedModelName);
  let apiLatencyMonitor   = useApiLatencyMonitor(tradeList);
  
  const [isDataMissing, setIsDataMissing] = useState<boolean>(false);
  const [isDataReady, setIsDataReady]     = useState<boolean>(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [AllTradeCopy, setAllTradeCopy]   = useState<TableData[]>([]);
  
  const totalRunningQty      = useRef<number>(0);
  const modelWisePLCopy      = useRef<{ [key: string]: any }>({});
  const selectedClientIDRef  = useRef<any>(selectedClientID);
  const selectedModelNameRef = useRef(selectedModelName);
  const strikeWiseQty        = useRef<{[key:string]:any}>({});
  const intervalIds          = useRef<any[]>([]);
  const sectionRef           = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible]       = useState(false);
  const [modelM2Mdata, setModelM2MData] = useState<{[key:string]:any}>({});

  const toggleModel = (modelKey: string) => {
    setExpandedModel(prev => (prev === modelKey ? null : modelKey));
  };
  useEffect(() => {
    if (selectedClientIDRef.current !== selectedClientID || selectedModelNameRef.current !== selectedModelName) {
      dispatch(setIsLoader(true));
      let updatedList: TableData[] = [];
      const sourceList = (now.getHours() >= CLOSE_HOUR ||
        (now.getHours() >= MARKET_CLOSE_HOUR && now.getMinutes() >= MARKET_CLOSE_MINUTE))
        ? AllTradeCopy : Object.values(tradeMapRef.current);
  
      updatedList = sourceList.filter((trade) =>
        (selectedClientID === 'All' || trade?.s_client_id === selectedClientID) &&
        (selectedModelName === 'All' || trade?.s_code.startsWith(fixedModelName[selectedModelName])) &&
        (["", "None"].includes(trade.s_status) || sourceList === AllTradeCopy)
      );
  
      dispatch(setTradeList(updatedList));
      dispatch(setIsLoader(false));
      selectedClientIDRef.current = selectedClientID;
      selectedModelNameRef.current = selectedModelName;
  
      modelWiseProfit.current = calculateModelWiseProfitWTRClient(
        modelWisePLCopy.current,
        selectedClientIDRef.current
      );
  
      const total = Object.values(modelWiseProfit.current)
        .reduce((mainSum: number, subModelObj: Record<string, number>) => {
          const subSum = Object.values(subModelObj).reduce((sum, val) => sum + Number(val || 0), 0);
          return mainSum + subSum;
        }, 0);
      totalProfit.current = Number(total.toFixed(2));
    }
  }, [selectedClientID, selectedModelName]);
  
  

  useEffect(() => {
    if (allCloseTrades.length > 0) {
      dispatch(setTradeList(allCloseTrades));
      setAllTradeCopy(allCloseTrades);
    }
  }, [allCloseTrades]);

  useEffect(() => {
    (async () => {
      let token: any = await getSessionToken();
      dispatch(setSessionToken(token));

      const mdlWiseProfit: any = await getModelWiseProfit();
      modelWiseProfit.current = calculateModelWiseProfitWTRClient(mdlWiseProfit, selectedClientIDRef.current);
      modelWisePLCopy.current = mdlWiseProfit;
      totalProfit.current = Object.values(modelWiseProfit.current)
        .reduce((mainSum: number, subModelObj: Record<string, number>) => {
          const subSum = Object.values(subModelObj).reduce((sum, val) => sum + val, 0);
          return mainSum + subSum;
        }, 0).toFixed(2);
      setIsDataReady(true);
      
      if(now.getHours() >= CLOSE_HOUR || (now.getHours() >= MARKET_CLOSE_HOUR && now.getMinutes() >= MARKET_CLOSE_MINUTE)){
        localStorage.removeItem('afterMarketApiCalled')
      }
    })();

    let isFetching: boolean = false;
    const fetchProfit = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const mdlWiseProfit: any = await getModelWiseProfit();
        modelWiseProfit.current = calculateModelWiseProfitWTRClient(mdlWiseProfit, selectedClientIDRef.current);
      } catch (error: any) {
        console.error("Failed to fetch model-wise profit", error);
      } finally {
        isFetching = false;
      }
    };

    const getModelAllocation = async()=>{
      try{
        let result = 0;
        const clientWiseAllocation:any = await getClientWiseAllocation();
        dispatch(setModelAllocation(clientWiseAllocation));
        Object.values(clientWiseAllocation).forEach((clientAlloc: any) => {
          Object.values(clientAlloc).forEach((value: any) => {
            result += Number(value);
          });
        });
        dispatch(setTotalMarginAllocated(result));
      }catch (error: any) {
        console.error("Failed to fetch client wise allocation", error);
      }
    }

    async function getModelM2MData(){
      try{
        let apiRespo:any = await fetchModelM2m();
        setModelM2MData(apiRespo)
      }catch(e:any){
        console.log(e); 
      }
    }

    getModelAllocation();
    getModelM2MData();
    
    const shouldRun = ()=>{
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      return !(hours>15 || (hours === 15 && minutes>=30))
    } 
    const runIfAllowed = (fn:()=>void)=>{
      if(shouldRun()) fn();
    }
    
    let intervalId1:any = setInterval(()=>runIfAllowed(fetchProfit), 3 * 60 * 1000);
    intervalIds.current.push(intervalId1);
    let intervalId2:any = setInterval(()=>runIfAllowed(getModelAllocation), 60 * 60 * 1000);
    intervalIds.current.push(intervalId2);
    let intervalId3:any = setInterval(()=>runIfAllowed(getModelM2MData), 10 * 1000);
    intervalIds.current.push(intervalId3);
    return () => {
      intervalIds.current.forEach((id)=>clearInterval(id));
      intervalIds.current = []; 
    }
  }, []);


  useEffect(() => {
    const runningQty: number = tradeList
      .filter((trade: any) => ["", "None"].includes(trade.s_status))
      .reduce((sum: any, trade: any) => sum + (trade.n_lot || 0), 0);
    totalRunningQty.current = runningQty;
  
    let newProfit: any = Object.values(modelWiseProfit.current)
      .reduce((mainSum: number, subModelObj: Record<string, number>) => {
        const subSum = Object.values(subModelObj).reduce((sum, val) => sum + Number(val || 0), 0);
        return mainSum + subSum;
      }, 0);
    newProfit = Number(newProfit.toFixed(2));
  
    if (Number(totalProfit.current) !== newProfit) {
      totalProfit.current = newProfit;
    }
  }, [tradeList]);
  

  const handleMessage = useCallback(async(newData: any) => {
    let rawData: any = JSON.parse(newData);
    const formattedData: TableData = rawData.data as TableData;
    if (["UPDATE", "INSERT"].includes(rawData?.operation)) {
      if (rawData?.type !== "missing_data_alert") {
        operationOnUpdate(formattedData, rawData);
        if (now.getHours() >= CLOSE_HOUR || (now.getHours() >= MARKET_CLOSE_HOUR && now.getMinutes() >= MARKET_CLOSE_MINUTE)) {
          localStorage.removeItem('afterMarketApiCalled')
        }
        let code: any = formattedData["s_code"].slice(0, 9).split('-')[0];
  
        for (const [shortPrefix, mappedPrefix] of Object.entries(prefix_map)) {
          if (code.startsWith(shortPrefix)) {
            code = mappedPrefix;
            break;
          }
        }
  
        if (!modelWiseProfit.current[code]) {
          modelWiseProfit.current[code] = {};
        }
        modelWiseProfit.current[code] = calculateModelWiseProfit(formattedData, rawData, modelWiseProfit.current[code]);
        modelWiseProfit.current = calculateModelWiseProfitWTRClient(modelWiseProfit.current, selectedClientIDRef.current);
  
        const newTotal = Object.values(modelWiseProfit.current).reduce((mainSum: number, subModelObj: Record<string, number>) => {
          const subSum = Object.values(subModelObj).reduce((sum, val) => sum + Number(val || 0), 0);
          return mainSum + subSum;
        }, 0);
        totalProfit.current = Number(newTotal.toFixed(2));
      }
    }
    if (rawData?.type === "missing_data_alert") {
      setIsDataMissing(rawData.missing_status);
    }
  }, []);
  

  const operationOnUpdate = (newTrade: TableData, rawData:any) => {
    const key: string = generateKey(newTrade);
    const existingTrade: any = tradeMapRef.current[key];
    const isRunningStatus: boolean = ["", "None", null].includes(newTrade.s_status);
    if (!isRunningStatus && existingTrade){
      delete tradeMapRef.current[key];
      if(Object.keys(tradeMapRef.current).length === 0)
        setIsDataMissing(false);
    } else if (!existingTrade || hasTradeChanged(existingTrade, newTrade)) {
      tradeMapRef.current[key] = { ...existingTrade, ...newTrade };
    }
    
    const updatedList: any = Object.values(tradeMapRef.current).filter(
      (trade: any) => ["", "None", null].includes(trade.s_status) && (selectedClientIDRef.current==='All' || trade?.s_client_id===selectedClientIDRef.current)
      && (selectedModelNameRef.current==='All' || trade?.s_code.startsWith(fixedModelName[selectedModelNameRef.current]))
    );
    dispatch(setTradeList(updatedList));

    let obj:any   = {};
    for(let i=0;i<updatedList.length;i++){
      let trade:any = updatedList[i];
      let code: any = trade["s_code"].slice(0, 9).split('-')[0];
      let key:any   = trade['n_strike_price']+'_'+trade['s_option_type'];

      if(!obj[key]){
        obj[key] = {};
      }
      if(!obj[key][code]){
        obj[key][code] = 0
      }
      obj[key][code] = Number(obj[key][code])+Number(trade['n_lot']);
    }
    strikeWiseQty.current = obj;
  };

  let socketStatus: string = useWebSocket(handleMessage);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting); 
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, []);
  
  
  return (
    <>
      <div className={`main_outer_div ${Object.keys(isModalOpen).length > 0 ? "blurred" : ""}`}>
        <div className="top-div">
          <div className="top_div_left">
            <div className="checking-div">
              <div className={`data_missing_div ${isDataMissing === true ? "glow" : ""}`}>
                <img src={`${isDataMissing ? "./attencion.png" : "./alert.png"}`} alt="img" className="img-icons" />
                <h3>Data Missing</h3>
              </div>
              <div className={`internet_check_div ${isOnline ? "" : "glow"}`}>
                <img src="./wifi.png" alt="img" className="img-icons" />
                <h3>Internet Lost</h3>
              </div>
              <div className={`latency_check_div ${apiLatencyMonitor !== "High" ? "" : "glow"}`}>
                <img src={`tachometer.png`} alt="img" className="img-icons" />
                <h3>Api Latency </h3>
              </div>
              <div className={`websockt_check_div ${socketStatus !== "connected" ? "glow" : ""}`}>
                <img src={`electricity.png`} alt="img" className="img-icons" />
                <h3>WebSocket</h3>
              </div>
            </div>
            <div className="live-qty-div">
              <div className="live-qty-wrapper">
                <span>Live Quantity - N50</span>
                <h1 className="live-qty-text">{totalRunningQty.current}<span style={{fontSize:"15px"}}>{totalRunningQty.current>0?'('+Number(totalRunningQty.current)/75+')':''}</span>&nbsp;<span style={{fontSize:"15px"}}>{totalRunningQty.current>0 ? `Trade-${tradeList.length}` : ''}</span></h1>
              </div>
            </div>
          </div>
          <div className="description-section">
            {isDataReady && (
              <>
                {fixedModelOrder.map((displayName) => {
                  const modelKeys = displayNameToModelKeys[displayName]; 
                  const matchingKey = modelKeys.find((key:any) =>
                    modelWiseProfit.current.hasOwnProperty(key)
                );
                  if (!matchingKey) return null;
                  return (
                    <ModelPLComponent
                      key={matchingKey}
                      modelName={matchingKey}
                      modelWiseProfit={modelWiseProfit}
                      expandedModel={expandedModel}
                      toggleModel={toggleModel}
                    />
                  );
                })}
              </>
            )}
          </div>
          <div className="description-section">
            {isDataReady && (
              <>
                {fixedModelOrderStrangles.map((displayName) => {
                  const modelKeys = displayNameToModelKeys[displayName]; 
                  const matchingKey = modelKeys.find((key:any) =>
                    modelWiseProfit.current.hasOwnProperty(key)
                );
                  if (!matchingKey) return null;
                  return (
                    <ModelPLComponent
                      key={matchingKey}
                      modelName={matchingKey}
                      modelWiseProfit={modelWiseProfit}
                      expandedModel={expandedModel}
                      toggleModel={toggleModel}
                    />
                  );
                })}
              </>
            )}
          </div>
        </div>
        <div className="middle-section">
          <TradesTable totalProfit={totalProfit.current}/>
        </div>
        <div className="bottom-section">
          <StrikeWiseQty data = {strikeWiseQty.current}/>
          <div className="performance-chart-div">
            <div className="selected-text-div">
              <h3 className="text-lg font-semibold text">Performance Chart</h3>
            </div>
            <div className="chart-main-div">
              <AreaChart input={modelM2Mdata} />
            </div>
          </div>
        </div>
        <div ref={sectionRef} className="footer-section">
          <h3 className="text-lg font-semibold text">Model Wise Performance Chart</h3>
          {isVisible ? (
          <motion.div
          initial={{ opacity: 0, y: 50 }}   
          animate={{ opacity: 1, y: 0 }}    
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Swiper
            spaceBetween={50}
            slidesPerView={3}
            navigation={true}
            modules={[Pagination, Navigation]}
            breakpoints={{
              320: { slidesPerView: 1 }, 
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 3 }, 
            }}
          >
            {fixedModelOrder.map((displayName) => {
              const modelExists = hasModelData(modelM2Mdata, fixedModelName[displayName]);
              if (!modelExists || ['OpL-M1','OpL-M2'].includes(displayName)) return null;
              return(<>
              <SwiperSlide key={displayName}>
                 
                <div className="model-chart-div">
                  <h3 className="text-lg font-semibold text" style={{margin:"5px 0 10px 5px", alignItems:"flex-start"}}>{displayName}</h3>
                  <AreaChartModelWise input={modelM2Mdata} modelName={displayName}/>
                </div>
              </SwiperSlide></>
            )})}
            {fixedModelOrderStrangles.map((displayName) => {
              const modelExists = hasModelData(modelM2Mdata, fixedModelName[displayName]);
              if (!modelExists) return null;
              return(<>
              <SwiperSlide key={displayName}>
                 
                <div className="model-chart-div">
                  <h3 className="text-lg font-semibold text" style={{margin:"5px 0 10px 5px", alignItems:"flex-start"}}>{displayName}</h3>
                  <AreaChartModelWise input={modelM2Mdata} modelName={displayName}/>
                </div>
              </SwiperSlide></>
            )})}
          </Swiper>
          </motion.div>):
          (
            <div style={{ height: "400px", textAlign: "center", color: "#aaa" }}>
              Loading charts when visible...
            </div>
          )  
        }
        </div>
      </div>
      {Object.keys(isModalOpen).length > 0 && (
        <Modal />
      )}
      {(Object.keys(squareOffResponse).length > 0 || Object.keys(slModifyResponse).length > 0)&& (
        <Tooltips />
      )}
    </>
  );
};
