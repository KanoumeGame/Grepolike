import React, { useState, useEffect } from 'react';
import shopItems from '../../gameData/shopItems';
import itemsConfig from '../../gameData/items.json';
import { useShopActions } from '../../hooks/actions/useShopActions';
import RunecoinIcon from '../icons/RunecoinIcon';

const VillageShopModal = ({ village, onClose, runecoinBalance }) => {
    const [currentItems, setCurrentItems] = useState([]);
    const [timeLeft, setTimeLeft] = useState('');
    const { purchaseItem } = useShopActions();
    const [message, setMessage] = useState('');

    useEffect(() => {
        const now = new Date();
        const refreshInterval = 8 * 60 * 60 * 1000; // 8 hours
        
        // Ensure lastShopRefresh is a valid timestamp number
        const lastRefreshTime = village.lastShopRefresh?.toDate ? village.lastShopRefresh.toDate().getTime() : village.lastShopRefresh || now.getTime();
        
        const timeSinceLastRefresh = now.getTime() - lastRefreshTime;
        const timeToNextRefresh = refreshInterval - timeSinceLastRefresh;

        if (timeSinceLastRefresh >= refreshInterval) {
            console.log("Shop should refresh for village:", village.id);
        }

        const villageLevel = village.level || 1;
        const seed = Math.floor(lastRefreshTime / 1000) + village.x + village.y;
        const generatedItems = [];
        const slots = 3 + Math.floor(villageLevel / 2);

        for (let i = 0; i < slots; i++) {
            const qualityRoll = Math.random() * 100;
            let quality;
            if (qualityRoll < 70) quality = 'common';
            else if (qualityRoll < 95) quality = 'uncommon';
            else quality = 'rare';

            const availableForQuality = shopItems[quality];
            if (availableForQuality.length > 0) {
                const itemIndex = (seed + i) % availableForQuality.length;
                generatedItems.push(availableForQuality[itemIndex]);
            }
        }
        setCurrentItems(generatedItems);

        const interval = setInterval(() => {
            const remaining = Math.max(0, timeToNextRefresh - (Date.now() - now.getTime()));
            const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((remaining / 1000 / 60) % 60);
            const seconds = Math.floor((remaining / 1000) % 60);
            setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }, 1000);

        return () => clearInterval(interval);

    }, [village]);

    const handlePurchase = async (item) => {
        try {
            await purchaseItem(item, village);
            setMessage(`Successfully purchased ${itemsConfig[item.itemId].name}!`);
        } catch (error) {
            setMessage(`Purchase failed: ${error.message}`);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-2xl">Village Shop</h3>
                    <div className="flex items-center">
                        <RunecoinIcon className="w-6 h-6 mr-2" />
                        <span className="font-bold text-lg">{runecoinBalance}</span>
                    </div>
                </div>
                <p className="text-sm text-gray-400 mb-4">Items refresh in: {timeLeft}</p>
                 {message && <p className="text-center text-yellow-400 mb-4">{message}</p>}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {currentItems.map((item, index) => {
                        const itemDetails = itemsConfig[item.itemId];
                        const canAfford = runecoinBalance >= item.cost;
                        return (
                            <div key={index} className={`p-4 rounded-lg border-2 ${item.quality === 'rare' ? 'border-purple-500' : item.quality === 'uncommon' ? 'border-blue-500' : 'border-gray-500'}`}>
                                <h4 className="font-bold">{itemDetails.name}</h4>
                                <p className="text-xs text-gray-400">{itemDetails.description}</p>
                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center">
                                        <RunecoinIcon className="w-5 h-5 mr-1" />
                                        <span>{item.cost}</span>
                                    </div>
                                    <button
                                        onClick={() => handlePurchase(item)}
                                        disabled={!canAfford}
                                        className={`btn text-sm py-1 px-3 ${canAfford ? 'btn-confirm' : 'btn-disabled'}`}
                                    >
                                        Buy
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                 <button onClick={onClose} className="btn btn-primary w-full mt-6">Close</button>
            </div>
        </div>
    );
};

export default VillageShopModal;

