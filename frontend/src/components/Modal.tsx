import React from "react";
import "./Modal.css";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../app/store";
import { setIsModelOpen, setSquareOffResponse } from "../features/trade/tradeSlice";
import { closeTrade } from "../services/apiServices";


export const Modal = () => {
  const dispatch = useDispatch();
  const isModelOpen = useSelector((state:RootState)=>state.trade.isModelOpen);
  const sessionToken = useSelector((state: RootState)=>state.trade.sessionToken);


  const handleSquareOff = async(isModelOpen:any)=>{
    let value:any = String(Object.values(isModelOpen)).split('_')
    const stoplossId:any = value[0];
    const clientID:string = value[1];
    let token:any = sessionToken[clientID];
    
    let response: any = await closeTrade(stoplossId, token);
    dispatch(setSquareOffResponse({[response?.type]: response?.description }));
    setTimeout(() => {
      dispatch(setSquareOffResponse({}));
    }, 3000);

    dispatch(setIsModelOpen({}))
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-text">Are you sure want to close the trade ?</h3>
        <div className="modal-btn-div">
          <button className="yes-btn" onClick={() => handleSquareOff(isModelOpen)}>YES</button>
          <button className="no-btn" onClick={() => dispatch(setIsModelOpen({}))}>NO</button>
        </div>
      </div>
    </div>
  );
};


