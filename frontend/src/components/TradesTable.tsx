import React, { useEffect, useRef, useState } from "react";
import { fixedModelName, generateKey, OptionsTableHeaderText, TableData } from "../services/util";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../app/store";
import { TradesRow } from "./TradeRow";
import { setSelectedClientId, setSelectedModelName} from "../features/trade/tradeSlice";
import "./HomePage.css";
import { useMemo } from "react";


type ModelAllocation = Record<string, number>;
type ClientWiseAllocation = Record<string, ModelAllocation>;

export const TradesTable = ({totalProfit}:{totalProfit:any})=>{
  let dispatch = useDispatch();
  const tradeList         = useSelector((state:RootState)=>state.trade.tradeList);
  const squareOffResponse = useSelector((state:RootState)=>state.trade.squareOffResponse);
  const tokenDetails      = useSelector((state:RootState)=>state.trade.sessionToken);
  const selectedID        = useSelector((state:RootState)=>state.trade.selectedClientId);
  const isLoader          = useSelector((state:RootState)=>state.trade.isLoader);
  const selectedModelName = useSelector((state:RootState)=>state.trade.selectedModelName);
  const modelAllocationClientWise = useSelector((state:RootState)=>state.trade.modelAllocation);
  
  const [clientID, setClientID] = useState<[]>([]);
  
  useEffect(()=>{
    let newTokenDetails:any = Object.keys(tokenDetails)
    setClientID((prev:any)=>{
      if(prev.length != newTokenDetails.length) return newTokenDetails
      else return prev;
    })
  },[tokenDetails]);

  const handleOptionSelect = (value:string)=>{
    localStorage.setItem("selectedClient",value);
    dispatch(setSelectedClientId(value));
  }
  const handleModelNameChange = (value:string)=>{
    localStorage.setItem("selectedModelName",value);
    dispatch(setSelectedModelName(value));
  }

  const getAllocatedMargin = (
    data: ClientWiseAllocation,
    id: string
  ): number => {
    if (id === "All") {
      return Object.values(data).reduce((sum, client) => {
        return (
          sum +
          Object.values(client).reduce((s, v) => s + v, 0)
        );
      }, 0);
    }
    if (!data[id]) return 0;
    return Object.values(data[id]).reduce((sum, v) => sum + v, 0);
  };
  
  const totalGainPerc: number = useMemo(() => {
    const allocated:number = getAllocatedMargin(modelAllocationClientWise, selectedID);
    if (allocated === 0) return 0;
  
    return (Number(totalProfit) / allocated) * 100;
  }, [selectedID, totalProfit, modelAllocationClientWise]);
  
  
  return(
      <div className="options_table_div">
          <div className="table-option-section">
            <div className="client-select_div total-pl">
              <span>TOTAL PL &nbsp;</span>
              <h2 className={`${totalProfit > 0 ? 'positive' : totalProfit == 0 ? 'neutral' : 'negative'}`}>{totalProfit} &nbsp; ({Number(totalGainPerc.toFixed(2))}%)</h2>
            </div>
            <div className="client-select_div">
              <span>MODEL &nbsp;</span>
              <select value={selectedModelName} onChange={(e:any)=>handleModelNameChange(e?.target?.value)}>
                {Object.keys(fixedModelName).map((id:any, idx:any)=>{
                  return <option key={idx} value={id}>{id}</option>
                })}
              </select>
            </div>
            <div className="client-select_div">
              <span>CLIENT ID &nbsp;</span>
              <select value={selectedID} onChange={(e:any)=>handleOptionSelect(e?.target?.value)}>
                <option value='All'>All</option>
                {clientID.length>0 && clientID.map((id:any, idx:any)=>{
                  return <option key={idx} value={id}>{id}</option>
                })}
              </select>
            </div>
          </div>
          
          <div className="table_wrapper">
            <table id="dataTable">
              <colgroup>
                <col style={{ width: "80px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "60px" }} />
                <col style={{ width: "45px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "75px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "60px" }} />
                <col style={{ width: "55px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "150px" }} />
              </colgroup>
              <thead className="tblHeader">
                <tr>
                  {OptionsTableHeaderText.map((header: string, idx: any) => {
                    return <th key={idx}>{header}</th>;
                  })}
                </tr>
              </thead>
              <tbody className="tblBody">
                {!isLoader ? tradeList?.length > 0 ? (
                  tradeList.map((row: TableData) => {
                    const isOpen: boolean = ["", "None"].includes(row.s_status);
                    const valueCheck: boolean = row.n_pl >= 0;
                    const isFailure: boolean = Object.keys(squareOffResponse)[0] === "error";
                    const hasRejectReason: boolean = row.s_cancel_reject_reason?.length > 0;
                    // const isMarkedFailure: boolean = row?.s_failure_status === true;
                    const rowClassName: string = `tbl-row
                      ${isOpen ? "open-trade" : ""} 
                      ${isFailure ? "open-trade-failure" : ""} 
                      ${hasRejectReason ? "blink open-trade-failure" : ""}`.trim();

                    let rowKey:any = generateKey(row); 
                    return (
                      <TradesRow 
                        key={generateKey(row)}
                        rowData={row}
                        className={rowClassName}
                        pl_className={`${valueCheck ? "positive" : "negative"}`}
                        isOpen={isOpen}
                        rowIdx={rowKey}
                      />
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={OptionsTableHeaderText.length} style={{ textAlign: "center", color: "grey" }}>
                      No Trade Available
                    </td>
                  </tr>
                ):<tr>
                <td colSpan={OptionsTableHeaderText.length} style={{ textAlign: "center"}}><div className="spinner"></div></td>
              </tr>}
              </tbody>
            </table>
          </div>
        </div>
  )
}