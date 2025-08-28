import React from 'react';
import '../../styles/tooltips.css';

const Tooltip = ({ visible, content, x, y }) => {
    if (!visible) return null;

    const style = {
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, 10px)', // Position below and centered
    };

    return (
        <div className="senate-tooltip" style={style}>
            {content}
        </div>
    );
};

export default Tooltip;
 
