import React, { useState, useMemo, useEffect } from 'react';
import tasks from '../../gameData/tasks.json';
import { useGame } from '../../contexts/GameContext';
import Countdown from '../map/Countdown';
import './Task.css';
import woodIcon from '../../images/resources/wood.png';
import stoneIcon from '../../images/resources/stone.png';
import silverIcon from '../../images/resources/silver.png';

const resourceIcons = {
    wood: woodIcon,
    stone: stoneIcon,
    silver: silverIcon,
};

const ActiveTaskModal = ({ activeTask, onClose, onComplete, onAbandon }) => {
    const { playerCities } = useGame();
    // For simplicity, we'll use resources/units from the first city
    const cityState = Object.values(playerCities)[0] || {};
    const [contribution, setContribution] = useState(0);

    const taskInfo = tasks[activeTask.taskId];
    const { requirement } = taskInfo;
    const isResourceTask = ['wood', 'stone', 'silver'].includes(requirement.type);

    const availableAmount = isResourceTask
        ? (cityState.resources?.[requirement.type] || 0)
        : (cityState.units?.[requirement.type] || 0);

    const progress = useMemo(() => {
        const contributed = activeTask.contributions?.[requirement.type] || 0;
        return (contributed / requirement.amount) * 100;
    }, [activeTask, requirement]);

    const canComplete = availableAmount >= requirement.amount;

    const handleComplete = () => {
        onComplete(activeTask);
        onClose();
    };
    
    const handleAbandon = () => {
        onAbandon(activeTask);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="task-modal-container" onClick={e => e.stopPropagation()}>
                <div className="task-modal-header">
                    <h3>{taskInfo.title}</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="task-modal-content">
                    <p className="task-description">{taskInfo.description}</p>
                    <div className="task-timer">
                        Time Remaining: <Countdown arrivalTime={activeTask.expiresAt} />
                    </div>

                    <div className="task-progress-section">
                        <h4>Requirement: {requirement.amount.toLocaleString()} {requirement.type}</h4>
                        <p>Available: {Math.floor(availableAmount).toLocaleString()}</p>

                        <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: `${Math.min(100, progress)}%` }}>
                                {progress.toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4 mt-4">
                        <button onClick={handleAbandon} className="btn btn-danger">Abandon Task</button>
                        <button onClick={handleComplete} className="btn btn-confirm" disabled={!canComplete}>
                            {canComplete ? 'Complete Task' : 'Not Enough Resources'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActiveTaskModal;
