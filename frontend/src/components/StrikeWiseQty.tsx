import React, { useEffect, useState, useRef } from 'react';
import './StrikeWiseQty.css';
import { longModelName, modelActualName,modelName } from '../services/util';



const StrikeWiseQty = ({ data }:{data:any}) => {
  const newStrikes = useRef<{[key:string]:any}>({});
  
  const getQuantityForCode = (strike:any, code:any) => {
    return data[strike] && data[strike][code] ? data[strike][code] : null;
  };

  const renderCodeQuantities = (strike:any, codes:any) => {
    const validCodes:any = codes.filter((code:any) => getQuantityForCode(strike, code));
    if(validCodes.length === 0){
      return null;
    }
    return (
      <div className="code-list">
        {validCodes.map((code:any) => (
          <div key={code} className="code-item">
            <span className="code-name">{modelActualName(code)}</span>
            <span className="code-quantity">({getQuantityForCode(strike, code).toLocaleString()})</span>
          </div>
        ))}
      </div>
    );
  };

  useEffect(()=>{
    const newStrikes1:{[key:string]:any} = {};
    const strikes:any = Object.keys(data);
    strikes.forEach((strike:any) => {
      const parts = strike.split('_');
      const strikePrice = parts[0]; 
      const type = parts[1];       
      if (!newStrikes1[strikePrice]) {
        newStrikes1[strikePrice] = {
          isCallData: false,
          isPutData: false
        };
      }
      if (type === 'CE') {
        newStrikes1[strikePrice].isCallData = true;
      } else if (type === 'PE') {
        newStrikes1[strikePrice].isPutData = true;
      }
    });
    newStrikes.current = newStrikes1;
  },[data])

  return (
    <div className="main-container">
      <div className="table-wrapper">
        <table className="option-table">
          <thead>
            <tr className='header-text' >
              <th colSpan={2}>Call</th>
              <th rowSpan={2}>Strike</th>
              <th colSpan={2}>Put</th>
            </tr>
            <tr className='header-text' >
              <th>Buy</th>
              <th>Sell</th>
              <th>Buy</th>
              <th>Sell</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(newStrikes.current).length>0 ?Object.keys(newStrikes.current).map((strike:any) => {
              return (
                <tr key={strike}>
                  {/* Call Section */}
                  <td className='model-strike-text'>{newStrikes.current[strike]['isCallData']===true && renderCodeQuantities(strike+'_CE', longModelName)}</td>
                  <td className='model-strike-text'>
                    {newStrikes.current[strike]['isCallData']===true && renderCodeQuantities(strike+'_CE', modelName)}
                  </td>
                  {/* Strike Section */}
                  <td className="strike-cell">{strike}</td>
                  {/* Put Section */}
                  <td className='model-strike-text'>{newStrikes.current[strike]['isPutData']===true && renderCodeQuantities(strike+'_PE', longModelName)}</td>
                  <td className='model-strike-text'>
                    {newStrikes.current[strike]['isPutData']===true && renderCodeQuantities(strike+'_PE', modelName)}
                  </td>
                </tr>
              );
            }):(
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "grey" }}>
                    No data available
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
};

export default StrikeWiseQty;