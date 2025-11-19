import React, { useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";
import ArrowToggle from "./ArrowToggle";
import { longModelName, modelActualName } from "../services/util";
import { MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE } from "../services/useMarketCloseApiTrigger";
import "./ModelPLComponent.css";

interface ModelPLComponentParams {
  modelName: string;
  modelWiseProfit: React.MutableRefObject<{ [key: string]: any }>;
  expandedModel: string | null;
  toggleModel: (modelName: string) => void;
}

export const ModelPLComponent = ({
  modelName,
  modelWiseProfit,
  expandedModel,
  toggleModel,
}: ModelPLComponentParams) => {
  const trades = useSelector((state: RootState) => state.trade.tradeList);
  const modelAllocationClientWise = useSelector(
    (state: RootState) => state.trade.modelAllocation
  );
  const selectedClientId = useSelector(
    (state: RootState) => state.trade.selectedClientId
  );

 
  const usedMargin = useRef<number>(0);
  const modelAllocation = useRef<{ [key: string]: any }>({});
  const percentageUsed = useRef<number>(0);

  const getUsedMargin = useCallback((trades: any[], model: string): number => {
    return trades.reduce((acc, trade) => {
      const codePrefix = trade["s_code"]?.split("-")[0];
      if (codePrefix !== model) return acc;

      if (longModelName.includes(model)) {
        return acc + (trade["n_transaction"] || 0) * (trade["n_lot"] || 0);
      }
      return acc + (trade["n_strike_price"] || 0) * (trade["n_lot"] || 0) * 0.12;
    }, 0);
  }, []);

  function scaleMargin(value: number, whichOne:string) { 
    if (value > 1_00_000) return whichOne==='margin' ? (value / 1_00_00_000).toFixed(2): `${(value / 1_00_00_000).toFixed(2)} Cr`; // in crore
    if (value <= 1_00_000) return whichOne==='margin' ? (value / 1_00_000).toFixed(2) : `${(value / 1_00_000).toFixed(2)} L`;       // in lakh
    return value;
  }
  
  
  useEffect(() => {
    const allocationKeys = Object.keys(modelAllocationClientWise);
    if (allocationKeys.length === 0) return;

    const now = new Date();
    const afterMarketClose =
      now.getHours() >= MARKET_CLOSE_HOUR &&
      now.getMinutes() >= MARKET_CLOSE_MINUTE;

    if (afterMarketClose) {
      usedMargin.current = 0;
      percentageUsed.current = 0;
      return;
    }

    const currentMargin = getUsedMargin(trades, modelName);
    usedMargin.current = Number(scaleMargin(currentMargin, 'margin'));

    const allocationValue = Number(modelAllocation.current[modelName]);
    const percentage =
      allocationValue > 0
        ? Math.floor((currentMargin / allocationValue) * 100)
        : 0;

    percentageUsed.current = percentage;
  }, [trades, getUsedMargin, modelName, modelAllocationClientWise]);


  useEffect(() => {
    if (selectedClientId === "All") {
      const mergedAllocations: Record<string, number> = {};
      Object.values(modelAllocationClientWise).forEach((clientAlloc: any) => {
        for (const [model, value] of Object.entries(clientAlloc)) {
          mergedAllocations[model] = (mergedAllocations[model] || 0) + Number(value);
        }
      });
      modelAllocation.current = mergedAllocations;
    } else {
      modelAllocation.current =
        modelAllocationClientWise[selectedClientId] || {};
    }
  }, [modelAllocationClientWise, selectedClientId]);


  const subModels = modelWiseProfit.current[modelName];
  if (!subModels || typeof subModels !== "object") return null;

  const totalProfit = Object.values(subModels).reduce(
    (sum: number, val: any) => sum + (Number(val) || 0),
    0
  );

  const profitClass = totalProfit > 0 ? "positive" : totalProfit === 0 ? "neutral" : "negative";
  const isExpanded = expandedModel === modelName;

  const allocation = modelAllocation.current[modelName] || 0;
  const marginPerc = allocation > 0 ? (totalProfit / allocation) * 100 : 0;
  
  
  return (
    <div
      className={`Model-wrapper ${isExpanded ? "addHeight" : ""}`}
      key={modelName}
    >
      {/* HEADER ROW */}
      <div className="modelwise-qty-box">
        <div className="model-name-text">
          <span>{modelActualName(modelName)}</span>
          <ArrowToggle modelName={modelName} toggleModel={toggleModel} />
        </div>
        <div className="model-name-text">
          <h3 className={`qty-text ${profitClass} font-size`}>
            {totalProfit > 0
              ? `+${totalProfit.toFixed(2)}`
              : totalProfit.toFixed(2)}
          </h3>
          {allocation !== undefined && (
            <span className={profitClass} style={{ marginTop: "5px" }}>
              {marginPerc.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* MARGIN DISPLAY */}
      {allocation !== undefined && (
        <div className="one-model">
          <div className="display">
            <span className="text">
              {usedMargin.current.toFixed(3)}{" "}
              <span className="percentage-text">
                ({percentageUsed.current}%)
              </span>
            </span>
            <span className="text-head">
              &nbsp;of&nbsp;
              {allocation ? scaleMargin(allocation,'allocation'): 0}
            </span>
          </div>
        </div>
      )}

      {/* SUBMODELS SECTION */}
      <div className={`sub-models ${isExpanded ? "expanded" : ""}`}>
        {isExpanded &&
          Object.entries(subModels).map(([subKey, subProfit]: any) => {
            const profitValue = Number(subProfit) || 0;
            const subProfitClass =
              profitValue > 0
                ? "positive"
                : profitValue === 0
                ? "neutral"
                : "negative";
            const profitText =
              profitValue > 0
                ? `+${profitValue.toFixed(2)}`
                : profitValue.toFixed(2);

            return (
              <div key={subKey} className="sub-model-row">
                <span>{subKey.split("_")[0]}</span>
                <strong className={`qty-text ${subProfitClass}`}>
                  {profitText}
                </strong>
              </div>
            );
          })}
      </div>
    </div>
  );
};
