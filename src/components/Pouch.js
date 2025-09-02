// src/components/Pouch.js
import React, { useState, useRef } from 'react';
import itemsConfig from '../gameData/items.json';
import { useItemActions } from '../hooks/actions/useItemActions';
import './Pouch.css';

const Pouch = ({ items, onClose }) => {
    const { activateItem } = useItemActions();
    const [isUsingItemId, setIsUsingItemId] = useState(null);
    const [hoveredItemId, setHoveredItemId] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const pouchContainerRef = useRef(null);

    const handleUseItem = async (itemId) => {
        if (isUsingItemId) return;
        setIsUsingItemId(itemId);
        try {
            await activateItem(itemId);
        } catch (error) {
            console.error("Failed to use item:", error);
        } finally {
            setIsUsingItemId(null);
        }
    };

    const getItemIconStyle = (item) => {
        if (!item || !item.sprite) return {};
        const xPos = item.sprite.x * (100 / 3);
        const yPos = item.sprite.y * (100 / 3);
        return {
            backgroundPosition: `${xPos}% ${yPos}%`,
        };
    };

    const getQualityClass = (quality) => {
        switch(quality) {
            case 'rare': return 'pouch-item-icon-rare';
            case 'uncommon': return 'pouch-item-icon-uncommon';
            default: return 'pouch-item-icon-common';
        }
    };

    const handleMouseEnter = (e, itemId) => {
        const itemDetails = itemsConfig[itemId];
        if (!itemDetails) return;
    
        setHoveredItemId(itemId);
        if (e.currentTarget && pouchContainerRef.current) {
            const itemRect = e.currentTarget.getBoundingClientRect();
            const containerRect = pouchContainerRef.current.getBoundingClientRect();
            
            setTooltipPosition({
                top: itemRect.top - containerRect.top + (itemRect.height / 2),
                left: itemRect.left - containerRect.left + itemRect.width + 10,
            });
        }
    };
    
    const handleMouseLeave = () => {
        setHoveredItemId(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div ref={pouchContainerRef} className="pouch-container" onClick={e => e.stopPropagation()}>
                <div className="pouch-header">
                    <h2>Pouch</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="pouch-content">
                    {Object.entries(items).length > 0 ? (
                        <div className="pouch-grid">
                            {Object.entries(items).map(([itemId, count]) => {
                                if (count === 0) return null;
                                const itemDetails = itemsConfig[itemId];
                                if (!itemDetails) return null;
                                return (
                                    <div
                                        key={itemId}
                                        className="pouch-item-wrapper"
                                        onMouseEnter={(e) => handleMouseEnter(e, itemId)}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className={`pouch-item-icon ${getQualityClass(itemDetails.quality)}`} style={getItemIconStyle(itemDetails)}>
                                            <span className="pouch-item-count">{count}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center p-4">Your pouch is empty.</p>
                    )}
                </div>
                 {hoveredItemId && itemsConfig[hoveredItemId] && (
                    <div 
                        className="pouch-item-tooltip" 
                        style={{ 
                            top: `${tooltipPosition.top}px`, 
                            left: `${tooltipPosition.left}px`,
                            transform: 'translateY(-50%)' 
                        }}
                    >
                        <h4 className="item-name">{itemsConfig[hoveredItemId].name}</h4>
                        <p className="item-description">{itemsConfig[hoveredItemId].description}</p>
                        <button
                            onClick={() => handleUseItem(hoveredItemId)}
                            className="use-item-btn"
                            disabled={isUsingItemId === hoveredItemId}
                        >
                            {isUsingItemId === hoveredItemId ? 'Using...' : 'Use'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Pouch;

