import React, { useEffect, useState } from "react";
import "./Tooltips.css";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";

export const Tooltips = () => {
  const squareOffResponse = useSelector((state: RootState) => state.trade.squareOffResponse);
  const slModifyResponse = useSelector((state: RootState) => state.trade.slModifyResponse);

  const [type, setType] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (Object.keys(squareOffResponse).length > 0) {
      setType(Object.keys(squareOffResponse)[0]);
      setMessage(Object.values(squareOffResponse)[0] as string);
    } else if (Object.keys(slModifyResponse).length > 0) {
      setType(Object.keys(slModifyResponse)[0]);
      setMessage(Object.values(slModifyResponse)[0] as string);
    }
  }, [squareOffResponse, slModifyResponse]);  
  

  return (
    <div className={`tooltip-wrapper`}>
      <div className={`tooltip ${type === "error" ? "failed" : "success"}`}>
        <img
          src={`${type === "error" ? "./icons-fail.png" : "./icons-success.png"}`}
          alt="img"
          className="tooltip-img"
        />
        <h4>{message}</h4>
      </div>
    </div>
  );
};
