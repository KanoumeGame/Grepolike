// src/components/map/RescueModal.js
import React, { useState, useMemo } from 'react';
import { useGame } from '../../contexts/GameContext';
import { calculateDistance, calculateTravelTime, formatTravelTime } from '../../utils/travel';
import heroesConfig from '../../gameData/heroes.json';
import silverImage from '../../images/resources/silver.png';
import './MovementModal.css'; // Reusing styles

const RescueModal = ({ targetCity, onSend, onClose, setMessage }) => {
    const { gameState, worldState } = useGame();
    const [silverAmount, setSilverAmount] = useState('');
    const heroToRescue = heroesConfig[targetCity.capturedHero[0]];

    const travelTime = useMemo(() => {
        if (!gameState || !targetCity || !worldState) return '00:00:00';
        const distance = calculateDistance(gameState, targetCity);
        // Agents travel at a fixed speed, similar to scouts
        const timeInSeconds = calculateTravelTime(distance, 10, 'scout', worldState, ['land']);
        return formatTravelTime(timeInSeconds);
    }, [gameState, targetCity, worldState]);

    const handleSend = () => {
        const amount = parseInt(silverAmount, 10) || 0;
        if (amount <= 0) {
            setMessage("You must send some silver for the mission.");
            return;
        }
        if ((gameState.cave?.silver || 0) < amount) {
            setMessage("Not enough silver in your cave for this mission.");
            return;
        }
        onSend({
            mode: 'rescue_hero',
            targetCity,
            silver: amount,
            heroToRescueId: targetCity.capturedHero[0],
            travelTime,
        });
        onClose();
    };

    const availableCaveSilver = gameState.cave?.silver || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="movement-modal-container" onClick={e => e.stopPropagation()}>
                <h3 className="movement-modal-header">Rescue {heroToRescue.name}</h3>
                <div className="movement-modal-content">
                    <p className="text-center mb-4">Send a Liberator to rescue <strong>{heroToRescue.name}</strong> from <strong>{targetCity.cityName}</strong>. Success depends on the amount of silver you send to bribe guards and create distractions.</p>
                    <div className="unit-selection-section">
                        <h4 className="unit-selection-header">Mission Funds</h4>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <img src={silverImage} alt="Silver" className="w-8 h-8"/>
                                <span>Silver from Cave ({Math.floor(availableCaveSilver)})</span>
                            </div>
                            <input
                                type="number"
                                value={silverAmount}
                                onChange={(e) => setSilverAmount(e.target.value)}
                                className="bg-white/50 border border-yellow-800/50 p-1 rounded text-gray-800 w-32"
                                placeholder="Amount"
                                max={availableCaveSilver}
                                min="0"
                            />
                        </div>
                    </div>
                </div>
                <div className="movement-modal-footer">
                    <p className="mb-2">Travel Time: <span className="font-bold text-yellow-600">{travelTime}</span></p>
                    <button onClick={handleSend} className="btn btn-primary w-full py-2 mt-4">
                        Launch Rescue Mission
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RescueModal;
