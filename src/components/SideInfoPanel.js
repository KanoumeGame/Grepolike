import React from 'react';
import WorshipDisplay from './city/WorshipDisplay';
import TroopDisplay from './TroopDisplay';
import HeroDisplay from './city/HeroDisplay';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';

import settingsIcon from '../images/ui/settings.png';
import cheatsIcon from '../images/ui/cheats.png';
import worldMapIcon from '../images/ui/world_map.png';

const ActionButtons = ({ onOpenSettings, onOpenCheats, onGenerateMap, isGeneratingMap }) => {
    const { userProfile } = useAuth();
    const isAdmin = userProfile?.is_admin;

    const buttonStyle = {
        color: '#d4af37',
        border: '1px solid',
        borderImageSource: 'linear-gradient(to top, #d4af37, #b8860b)',
        borderImageSlice: 1,
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.7)',
        boxShadow: 'inset 0 2px 3px rgba(0, 0, 0, 0.5), 0 2px 2px rgba(255, 255, 255, 0.2)',
    };

    return (
        <div className="w-40 p-1.5 flex flex-col gap-1.5" style={{
            backgroundImage: `url(${require('../images/bg/right_background.png')})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            color: '#4a2c2a'
        }}>
            <h3 className="hero-display-header">Actions</h3>
            <div className="flex flex-col gap-1">
                <button onClick={onOpenSettings} className="w-full relative flex items-center justify-start p-2 rounded-md transition-colors duration-200 font-semibold text-sm gap-2" style={buttonStyle} title="Settings">
                    <img src={settingsIcon} alt="Settings" className="w-8 h-8 object-contain" />
                    <span>Settings</span>
                </button>
                <button onClick={onGenerateMap} className="w-full relative flex items-center justify-start p-2 rounded-md transition-colors duration-200 font-semibold text-sm gap-2 disabled:opacity-50" style={buttonStyle} disabled={isGeneratingMap} title="Generate World Map Image">
                    <img src={worldMapIcon} alt="World Map" className="w-8 h-8 object-contain" />
                    <span>World Map</span>
                </button>
                {isAdmin && (
                    <button onClick={onOpenCheats} className="w-full relative flex items-center justify-start p-2 rounded-md transition-colors duration-200 font-semibold text-sm gap-2" style={buttonStyle} title="Open City Cheats">
                        <img src={cheatsIcon} alt="Cheats" className="w-8 h-8 object-contain" />
                        <span>Cheats</span>
                    </button>
                )}
            </div>
        </div>
    );
};


const SideInfoPanel = ({
    gameState,
    className,
    onOpenPowers,
    movements,
    onOpenSettings,
    onOpenCheats,
    onGenerateMap,
    isGeneratingMap
}) => {
    const { activeCityId } = useGame();
    if (!gameState || !gameState.playerInfo) { //  Added a check for playerInfo
        return null;
    }
    return (
        <div className={className}>
            <ActionButtons
                onOpenSettings={onOpenSettings}
                onOpenCheats={onOpenCheats}
                onGenerateMap={onGenerateMap}
                isGeneratingMap={isGeneratingMap}
            />
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
            />
            <TroopDisplay units={gameState.units || {}} />
        </div>
    );
};

export default SideInfoPanel;
