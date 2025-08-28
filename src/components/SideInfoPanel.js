/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
import React from 'react';
import WorshipDisplay from './city/WorshipDisplay';
import TroopDisplay from './TroopDisplay';
import HeroDisplay from './city/HeroDisplay';
import { useGame } from '../contexts/GameContext';

const SideInfoPanel = ({ gameState, className, onOpenPowers, movements, onSendLiberator, combinedSlots }) => {
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
            />
            <HeroDisplay 
                heroes={gameState.heroes} 
                agents={gameState.agents} 
                movements={movements} 
                activeCityId={activeCityId} 
                onSendLiberator={onSendLiberator}
                combinedSlots={combinedSlots}
            />
            <TroopDisplay units={gameState.units || {}} />
        </div>
    );
};

export default SideInfoPanel;
