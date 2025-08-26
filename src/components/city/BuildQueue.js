import React, { useState, useEffect, useRef } from 'react';
import buildingConfig from '../../gameData/buildings.json';
import specialBuildingsConfig from '../../gameData/specialBuildings.json';
import vipConfig from '../../gameData/vip.json';
import { useGame } from '../../contexts/GameContext';
import PlatinumIcon from '../icons/PlatinumIcon';

const buildingImages = {};
const contexts = [
    require.context('../../images/buildings', false, /\.(png|jpe?g|svg)$/),
    require.context('../../images/special_buildings', false, /\.(png|jpe?g|svg)$/)
];
contexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        buildingImages[key] = context(item);
    });
});
const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const QueueItem = ({ item, isFirst, onCancel, isLast, onHover, onLeave, onCompleteInstantly }) => {
    const { playerGameData } = useGame();
    const [timeLeft, setTimeLeft] = useState(0);
    const vipLevel = playerGameData?.vipLevel || 1;
    const freeCompletionTime = (vipConfig.bonuses.freeCompletionMinutes[vipLevel - 1] || 0) * 60;
    const itemRef = useRef(null);

    useEffect(() => {
        if (!isFirst) return;
        const calculateTimeLeft = () => {
            const endTime = (item.endTime instanceof Date) ? item.endTime : new Date(item.endTime);
            if (isNaN(endTime.getTime())) {
                setTimeLeft(0);
                return;
            }
            const remaining = Math.max(0, endTime.getTime() - Date.now());
            setTimeLeft(remaining / 1000);
        };
        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(interval);
    }, [item.endTime, isFirst]);

    const building = item.isSpecial
        ? specialBuildingsConfig[item.buildingId]
        : buildingConfig[item.buildingId];
    if (!building) return null;
    const imageSrc = buildingImages[building.image];
    const isDemolition = item.type === 'demolish';
    const title = isDemolition
        ? `Demolish ${building.name} to Lvl ${item.level}`
        : `${building.name} (Level ${item.level})`;
    const levelText = isDemolition ? ` Lvl ${item.level}` : `^${item.level}`;
    const showCompleteButton = isFirst && timeLeft > 0 && timeLeft <= freeCompletionTime;

    return (
        <div
            ref={itemRef}
            className={`relative w-16 h-16 bg-gray-700 border-2 rounded-md flex-shrink-0 ${isDemolition ? 'border-red-500' : 'border-gray-600'}`}
            onMouseEnter={() => onHover(item, itemRef.current)}
            onMouseLeave={onLeave}
            title={title}
        >
            <img src={imageSrc} alt={building.name} className="w-full h-full object-contain p-1" />
             <span className={`absolute top-0 right-0 text-black text-xs font-bold px-1 rounded-bl-md z-10 ${isDemolition ? 'bg-red-500 text-white' : 'bg-yellow-500'}`}>
                {levelText}
            </span>
            {isFirst && (
                <span className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-red-500 text-xs text-center py-0.5 font-mono">
                    {formatTime(timeLeft)}
                </span>
            )}
            {showCompleteButton && (
                <button
                    onClick={() => onCompleteInstantly(item)}
                    className="absolute bottom-5 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center bg-green-500/80 text-white rounded-full font-bold text-base hover:bg-green-400 transition-colors z-20 border-2 border-green-300"
                    title="Complete Now"
                >
                    🔨
                </button>
            )}
            {isLast && (
                <button
                    onClick={onCancel}
                    className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-red-600 text-white rounded-full font-bold text-xs hover:bg-red-500 transition-colors z-10"
                    title="Cancel Construction"
                >
                    &times;
                </button>
            )}
        </div>
    );
};

const BuildQueue = ({ buildQueue, onCancel, onCompleteInstantly, onSpeedUp }) => {
    const [hoveredItem, setHoveredItem] = useState(null);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const tooltipTimeoutRef = useRef(null);
    const queueContainerRef = useRef(null);
    const queueCapacity = 5;
    const emptySlots = Array(Math.max(0, queueCapacity - (buildQueue?.length || 0))).fill(null);
    
    const handleMouseEnter = (item, element) => {
        clearTimeout(tooltipTimeoutRef.current);
        if (element && queueContainerRef.current) {
            const queueRect = queueContainerRef.current.getBoundingClientRect();
            const itemRect = element.getBoundingClientRect();

            setTooltipStyle({
                position: 'absolute',
                top: `${itemRect.top - queueRect.top + itemRect.height / 2}px`,
                left: `${itemRect.left - queueRect.left + itemRect.width}px`,
                transform: 'translateY(-50%)',
                marginLeft: '10px'
            });
            setHoveredItem(item);
        }
    };

    const handleMouseLeave = () => {
        tooltipTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
        }, 200);
    };

    const renderTooltip = () => {
        if (!hoveredItem) return null;
        const building = hoveredItem.isSpecial
            ? specialBuildingsConfig[hoveredItem.buildingId]
            : buildingConfig[hoveredItem.buildingId];
        const isFirst = buildQueue[0]?.id === hoveredItem.id;
        const completionTime = hoveredItem.endTime instanceof Date ? hoveredItem.endTime : new Date(hoveredItem.endTime);

        return (
            <div 
                className="unit-tooltip" 
                style={{...tooltipStyle, zIndex: 100, width: '220px' }}
                onMouseEnter={() => clearTimeout(tooltipTimeoutRef.current)}
                onMouseLeave={handleMouseLeave}
            >
                <div className="tooltip-header"><h3 className="tooltip-title">{building.name} (Level {hoveredItem.level})</h3></div>
                <div className="tooltip-body" style={{ padding: '0.5rem' }}>
                    <p className="tooltip-description" style={{ fontSize: '0.8rem' }}>
                        Completes at: {completionTime.toLocaleTimeString()}
                    </p>
                    {isFirst && (
                        <button onClick={() => onSpeedUp(hoveredItem)} className="btn btn-primary mt-2">
                            Speed Up (50 <PlatinumIcon className="inline-block w-4 h-4" />)
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-900 p-2 rounded-lg mb-4 flex items-center gap-3 border border-gray-700">
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-4xl flex-shrink-0" title="Construction">
                🔨
            </div>
            <div ref={queueContainerRef} className="flex-grow flex items-center gap-3 relative">
                {buildQueue && buildQueue.map((item, index) => (
                    <QueueItem
                        key={item.id || `${item.buildingId}-${index}`}
                        item={item}
                        isFirst={index === 0}
                        isLast={index === buildQueue.length - 1}
                        onCancel={() => onCancel(item)}
                        onHover={handleMouseEnter}
                        onLeave={handleMouseLeave}
                        onCompleteInstantly={onCompleteInstantly}
                    />
                ))}
                {emptySlots.map((_, index) => (
                    <div key={`empty-${index}`} className="w-16 h-16 bg-gray-800 border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center flex-shrink-0">
                        <img src={buildingImages['temple.png']} alt="Empty Slot" className="w-10 h-10 opacity-20" />
                    </div>
                ))}
                {hoveredItem && renderTooltip()}
            </div>
        </div>
    );
};
export default BuildQueue;
