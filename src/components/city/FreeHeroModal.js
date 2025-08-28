import React, { useState } from 'react';
import heroesConfig from '../../gameData/heroes.json';
import { useGame } from '../../contexts/GameContext';

const FreeHeroModal = ({ hero, onClose, onSend }) => {
    const { gameState } = useGame();
    const heroConfig = heroesConfig[hero.heroId];
    const maxSilver = gameState.cave?.silver || 0;
    const [silverAmount, setSilverAmount] = useState(Math.min(100, maxSilver));

    const handleSend = () => {
        if (silverAmount > 0 && silverAmount <= maxSilver) {
            onSend(hero, hero.targetCityData, silverAmount);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4">Rescue {heroConfig.name}</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Your hero is captured in {hero.targetCityData.cityName}. Send a Liberator with silver from your cave to attempt a rescue.
                    Success depends on offering more silver than is in the enemy's cave.
                </p>
                <div className="my-4">
                    <label htmlFor="silver" className="block text-sm font-medium text-gray-300">
                        Silver to Send (From Cave: {maxSilver.toLocaleString()})
                    </label>
                    <input
                        type="range"
                        min="0"
                        max={maxSilver}
                        value={silverAmount}
                        onChange={(e) => setSilverAmount(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                        type="number"
                        value={silverAmount}
                        onChange={(e) => setSilverAmount(Math.max(0, Math.min(maxSilver, Number(e.target.value) || 0)))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mt-2 text-white text-center"
                    />
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button
                        onClick={handleSend}
                        className="btn btn-primary"
                        disabled={silverAmount <= 0 || silverAmount > maxSilver}
                    >
                        Send Liberator
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FreeHeroModal;
