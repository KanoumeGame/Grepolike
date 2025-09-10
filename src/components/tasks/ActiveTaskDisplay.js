import React from 'react';
import tasks from '../../gameData/tasks.json';
import './Task.css';

const ActiveTaskDisplay = ({ activeTasks, onOpenTaskModal }) => {
    if (!activeTasks || activeTasks.length === 0) {
        return null;
    }

    const task = tasks[activeTasks[0].taskId];

    return (
        <div className="active-task-display" onClick={() => onOpenTaskModal(activeTasks[0])}>
            <div className="task-icon-container">
                📜
            </div>
            <div className="task-info">
                <p className="task-title">{task.title}</p>
                <p className="task-cta">View Progress</p>
            </div>
        </div>
    );
};

export default ActiveTaskDisplay;
