// src/components/Pouch.js
import React, { useState } from 'react';
import itemsConfig from '../gameData/items.json';
import { useItemActions } from '../hooks/actions/useItemActions';
import './Pouch.css';

const Pouch = ({ items, onClose }) => {
    const { activateItem } = useItemActions();
    const [isUsingItemId, setIsUsingItemId] = useState(null);
    const [hoveredItemId, setHoveredItemId] = useState(null);

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="pouch-container" onClick={e => e.stopPropagation()}>
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
                                const isUsingThisItem = isUsingItemId === itemId;
                                return (
                                    <div
                                        key={itemId}
                                        className="pouch-item-wrapper"
                                        onMouseEnter={() => setHoveredItemId(itemId)}
                                        onMouseLeave={() => setHoveredItemId(null)}
                                    >
                                        <div className={`pouch-item-icon ${getQualityClass(itemDetails.quality)}`} style={getItemIconStyle(itemDetails)}>
                                            <span className="pouch-item-count">{count}</span>
                                        </div>
                                        {hoveredItemId === itemId && (
                                            <div className="pouch-item-tooltip">
                                                <h4 className="item-name">{itemDetails.name}</h4>
                                                <p className="item-description">{itemDetails.description}</p>
                                                <button
                                                    onClick={() => handleUseItem(itemId)}
                                                    className="use-item-btn"
                                                    disabled={isUsingThisItem}
                                                >
                                                    {isUsingThisItem ? 'Using...' : 'Use'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center p-4">Your pouch is empty.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Pouch;
