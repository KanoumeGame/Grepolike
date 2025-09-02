import React from 'react';
import WorshipDisplay from './city/WorshipDisplay';
import TroopDisplay from './TroopDisplay';
import HeroDisplay from './city/HeroDisplay';
import { useGame } from '../contexts/GameContext';

const SideInfoPanel = ({
    gameState,
    className,
    onOpenPowers,
    movements,
    onOpenSettings,
    onOpenCheats,
    onGenerateMap,
    isGeneratingMap,
    onOpenManagementPanel,
    handleOpenEvents
}) => {
    const { activeCityId } = useGame();
    if (!gameState || !gameState.playerInfo) { //  Added a check for playerInfo
        return null;
    }
    return (
        <div className={className}>
            <WorshipDisplay
                godName={gameState.god}
                playerReligion={gameState.playerInfo.religion}
                worship={gameState.worship}
                buildings={gameState.buildings}
                onOpenPowers={onOpenPowers}
                onOpenSettings={onOpenSettings}
                onOpenCheats={onOpenCheats}
                onGenerateMap={onGenerateMap}
                isGeneratingMap={isGeneratingMap}
                onOpenManagementPanel={onOpenManagementPanel}
                handleOpenEvents={handleOpenEvents}
            />
            <HeroDisplay
                heroes={gameState.heroes}
                agents={gameState.agents}
                movements={movements}
                activeCityId={activeCityId}
            />
            <TroopDisplay units={gameState.units || {}} />
        </div>
    );
};

export default SideInfoPanel;