import React, { useState } from 'react';
import tasks from '../../gameData/tasks.json';
import PlatinumIcon from '../icons/PlatinumIcon';
import RunecoinIcon from '../icons/RunecoinIcon';

const TaskGiver = ({ npc, onClose, onAcceptTask }) => {
    const [selectedTask, setSelectedTask] = useState(null);
    const task = tasks[npc.taskId];

    const handleAccept = () => {
        onAcceptTask(npc);
        onClose();
    };

    const renderReward = () => {
        if (!task.reward) return null;
        const { type, amount } = task.reward;
        switch (type) {
            case 'resources':
                return <span>{amount.wood} Wood, {amount.stone} Stone, {amount.silver} Silver</span>;
            case 'platinum':
                return <span className="flex items-center">{amount} <PlatinumIcon className="w-4 h-4 ml-1" /></span>;
            case 'runecoins':
                return <span className="flex items-center">{amount} <RunecoinIcon className="w-4 h-4 ml-1" /></span>;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4">A Task from a Stranger</h3>
                <p className="text-gray-400 mb-4">{task.description}</p>
                <div className="bg-gray-700 p-3 rounded-lg mb-4">
                    <p><strong>Requires:</strong> {task.requirement.amount} {task.requirement.type}</p>
                    <p><strong>Reward:</strong> {renderReward()}</p>
                </div>
                <div className="flex justify-end space-x-4">
                    <button onClick={onClose} className="btn btn-secondary">Decline</button>
                    <button onClick={handleAccept} className="btn btn-primary">Accept Task</button>
                </div>
            </div>
        </div>
    );
};

export default TaskGiver;
