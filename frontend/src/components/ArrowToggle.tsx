import React, { useState } from 'react';
import './ArrowToggle.css';


const ArrowToggle = ({modelName, toggleModel}:{modelName:any, toggleModel:any}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleArrow = () => {
    setIsExpanded(!isExpanded);
    toggleModel(modelName);
  };

  return (
    <div className={`arrow-container ${isExpanded ? 'expanded' : ''}`} onClick={toggleArrow}>
      <span className="arrow" />
    </div>
  );
};

export default ArrowToggle;
