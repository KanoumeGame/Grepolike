/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
// src/components/Pouch.js
import React, { useState } from 'react';
import itemsConfig from '../gameData/items.json';
import { useItemActions } from '../hooks/actions/useItemActions';
import './Pouch.css';

const Pouch = ({ items, onClose }) => {
    const { activateItem } = useItemActions();
    const [isUsingItemId, setIsUsingItemId] = useState(null);

    const handleUseItem = async (itemId) => {
        if (isUsingItemId) return; // Prevent multiple clicks
        setIsUsingItemId(itemId);
        try {
            await activateItem(itemId);
        } catch (error) {
            console.error("Failed to use item:", error);
            // Optionally show an error message to the user
        } finally {
            setIsUsingItemId(null);
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
                        Object.entries(items).map(([itemId, count]) => {
                            const item = itemsConfig[itemId];
                            if (!item) return null;
                            const isUsingThisItem = isUsingItemId === itemId;
                            return (
                                <div key={itemId} className="item-card">
                                    <div className="item-info">
                                        <h4 className="item-name">{item.name} (x{count})</h4>
                                        <p className="item-description">{item.description}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleUseItem(itemId)} 
                                        className="use-item-btn"
                                        disabled={isUsingThisItem}
                                    >
                                        {isUsingThisItem ? 'Using...' : 'Use'}
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center p-4">Your pouch is empty.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Pouch;
