import React, { useState, useEffect, useRef, useCallback } from 'react';
import researchConfig from '../../gameData/research.json';
import ResearchQueue from './ResearchQueue';
import './AcademyMenu.css';

const researchImages = {};
const imageContext = require.context('../../images/research', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
  const key = item.replace('./', '').replace('.png', '');
  researchImages[key] = imageContext(item);
});

// Tooltip component
const Tooltip = ({ visible, x, y, children }) => {
  if (!visible) return null;
  return (
    <div
      className="research-tooltip"
      style={{ top: y, left: x }}
    >
      {children}
    </div>
  );
};

const AcademyMenu = ({ cityGameState, onResearch, onClose, researchQueue, onCancelResearch }) => {
  const { buildings, resources, research = {}, researchPoints = 0 } = cityGameState;
  const academyLevel = buildings.academy?.level || 0;

  const academyRef = useRef(null);
  const [position, setPosition] = useState({
    x: (window.innerWidth - 900) / 2,
    y: (window.innerHeight - 700) / 2
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Tooltip state
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    content: null,
  });

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('academy-header') || e.target.parentElement.classList.contains('academy-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  //  check if player can afford research
  const canAfford = (cost) => {
    return resources.wood >= cost.wood && resources.stone >= cost.stone && resources.silver >= cost.silver && researchPoints >= (cost.points || 0);
  };

  //  check if player meets research requirements, including items in the queue
  const meetsRequirements = (reqs) => {
    if (!reqs) return true;
    if (reqs.academy && academyLevel < reqs.academy) {
      return false;
    }
    if (reqs.research) {
      const isResearched = research[reqs.research];
      const isInQueue = (researchQueue || []).some(item => item.researchId === reqs.research);
      if (!isResearched && !isInQueue) {
        return false;
      }
    }
    return true;
  };

  const getRequirementsText = (reqs) => {
    if (!reqs) return '';
    const unmet = [];
    if (reqs.academy && academyLevel < reqs.academy) {
      unmet.push(`Academy Lvl ${reqs.academy}`);
    }
    if (reqs.research) {
      const isResearched = research[reqs.research];
      const isInQueue = (researchQueue || []).some(item => item.researchId === reqs.research);
      if (!isResearched && !isInQueue) {
        unmet.push(researchConfig[reqs.research].name);
      }
    }
    if (unmet.length > 0) {
      return `Requires: ${unmet.join(', ')}`;
    }
    return '';
  };

  const isResearchInQueue = (researchId) => {
    return (researchQueue || []).some(item => item.researchId === researchId);
  };

  const showTooltip = (e, content) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
      content,
    });
  };

  const hideTooltip = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
      <div
        ref={academyRef}
        className="academy-container"
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        style={{ top: `${position.y}px`, left: `${position.x}px` }}
      >
        <div className="academy-header">
          <h3>Academy (Level {academyLevel})</h3>
          <p>Research Points: {researchPoints}</p>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <div className="academy-grid">
          {Object.entries(researchConfig).map(([id, config]) => {
            const isResearched = cityGameState.research?.[id]?.completed;
            const requirementsMet = meetsRequirements(config.requirements);
            const affordable = canAfford(config.cost);
            const inQueue = isResearchInQueue(id);
            const isQueueFull = (researchQueue || []).length >= 5;
            const reqText = getRequirementsText(config.requirements);

            let buttonText = 'Research';
            let isDisabled = false;
            if (isResearched) {
              buttonText = 'Completed';
              isDisabled = true;
            } else if (inQueue) {
              buttonText = 'In Queue';
              isDisabled = true;
            } else if (isQueueFull) {
              buttonText = 'Queue Full';
              isDisabled = true;
            } else if (!requirementsMet) {
              buttonText = 'Locked';
              isDisabled = true;
            } else if (!affordable) {
              buttonText = 'No Resources';
              isDisabled = true;
            }

            const tooltipContent = (
              <>
                <h5 className="tooltip-title">{config.name}</h5>
                <p className="tooltip-desc">{config.description}</p>
                <div className="tooltip-cost">
                  Cost: {config.cost.wood}W, {config.cost.stone}S, {config.cost.silver}Ag, {config.cost.points || 0}RP
                </div>
                {reqText && <p className="tooltip-req">{reqText}</p>}
              </>
            );

            return (
              <div key={id} className={`research-card ${isResearched ? 'researched' : ''} ${!requirementsMet ? 'locked' : ''}`}>
                <div
                  className="research-icon"
                  style={{ backgroundImage: `url(${researchImages[id]})` }}
                  onMouseEnter={(e) => showTooltip(e, tooltipContent)}
                  onMouseLeave={hideTooltip}
                />
                <button
                  onClick={() => onResearch(id)}
                  disabled={isDisabled}
                  className={`btn research-btn ${isResearched ? 'completed' : inQueue ? 'in-queue' : 'btn-primary'}`}
                >
                  {buttonText}
                </button>
              </div>
            );
          })}
        </div>
        <ResearchQueue researchQueue={researchQueue} onCancel={onCancelResearch} />
        <Tooltip visible={tooltip.visible} x={tooltip.x} y={tooltip.y}>
          {tooltip.content}
        </Tooltip>
      </div>
    </div>
  );
};

export { AcademyMenu };
