import React, { useEffect, useState } from "react";
import { TableData, findLastStoploss} from "../services/util";
import { useDispatch, useSelector } from "react-redux";
import { setIsEditable, setIsModelOpen, setManualStoplossPrice,setSLModifyResponse } from "../features/trade/tradeSlice";
import { RootState } from "../app/store";
import { modifyStoploss } from "../services/apiServices";

const safeFixed = (val:any, digits=2)=>{
    return typeof val === "number" && !isNaN(val) ? val.toFixed(digits) : val || val;
}

export const TradesRow = React.memo(({ rowData, className, pl_className, isOpen , rowIdx}: { rowData: TableData, className?:string, pl_className?:string, isOpen:boolean, rowIdx:any}) => {
    const dispatch = useDispatch();
    let stoploss:number = findLastStoploss(rowData);
    let token:any = useSelector((state:RootState)=>state.trade.sessionToken);
    let isEditable:any  = useSelector((state:RootState)=>state.trade.isEditable);
    const [manualStoploss, setManualStoploss] = useState<any>(safeFixed(stoploss));
    
    useEffect(()=>{
        dispatch(setManualStoplossPrice(manualStoploss));
    },[manualStoploss])
    
    const handleModifyStoploss = async() =>{
        try{
            let response:any = modifyStoploss(token[rowData?.s_client_id],rowData?.s_stoploss_order_id,stoploss,manualStoploss,rowData?.n_lot,rowData?.j_target_stoploss);
            dispatch(setSLModifyResponse({[response?.type]: response?.description }));
            setTimeout(() => {
                dispatch(setSLModifyResponse({}));
                dispatch(setManualStoplossPrice(manualStoploss));
                dispatch(setIsEditable(null));
            }, 3000);
        }catch(e:any){
            dispatch(setSLModifyResponse({[e?.type]: e?.description}));
            setTimeout(() => {
                dispatch(setSLModifyResponse({}));
                dispatch(setIsEditable(null));
            }, 3000);
        }
    }
    

    return (
        <tr className={className}>
            <td>{(isOpen && (isEditable !== rowIdx)) ? 
                <div className="action-div">
                    <button className="squareOff-btn" onClick={()=>dispatch(setIsModelOpen({"true":`${rowData?.s_stoploss_order_id}_${rowData?.s_client_id}`}))}>Close</button>
                    <button className="modify-btn" onClick={()=>dispatch(setIsEditable(rowIdx))}>Edit</button>
                </div>:
                isOpen?<div className="action-div">
                    <button className="squareOff-btn" onClick={()=>handleModifyStoploss()}>Save</button>
                    <button className="modify-btn" onClick={()=>dispatch(setIsEditable(null))}>Cancel</button>
                </div>:<></>}
            </td>
            <td>{rowData?.s_main_order_id}</td>
            <td>{rowData?.s_stoploss_order_id}</td>
            <td>{rowData?.n_strike_price}&nbsp;{rowData?.s_option_type}</td>
            <td>{rowData?.n_lot}</td>
            <td>{safeFixed(rowData?.n_transaction)}</td>
            <td>{rowData?.dt_entry_time}</td>
            <td>{rowData?.dt_exit_time}</td>
            <td>{safeFixed(rowData?.n_exit_price)}</td>
            <td className={pl_className}>{rowData?.n_pl>0?`+${safeFixed(rowData?.n_pl)}`:safeFixed(rowData?.n_pl)}</td>
            <td>{isEditable === rowIdx ? <input type="text" className='stoploss-input-box' value={manualStoploss} onChange={(e:any)=>setManualStoploss(e?.target?.value)}></input>
                :safeFixed(stoploss)}</td>
            <td>{rowData?.s_sl_status}</td>
            <td className="client-id-row"><span>{rowData?.s_code}</span><span>({rowData?.s_client_id})</span></td>
            <td data-fulltext={`${String(rowData?.s_cancel_reject_reason).split(":")[1]}`}>{String(rowData?.s_cancel_reject_reason).split(":")[1]}</td>
        </tr>
    );
});
