import React, { useState, useRef, useEffect } from 'react';
import godsConfig from '../../gameData/gods.json';
import spellsIcon from '../../images/spells.png';
import { useAuth } from '../../contexts/AuthContext';

import settingsIcon from '../../images/ui/settings.png';
import cheatsIcon from '../../images/ui/cheats.png';
import worldMapIcon from '../../images/ui/world_map.png';
import managerIcon from '../../images/ui/manager.png';
import eventsIcon from '../../images/ui/events.png';

// Dynamically import all images from the images/gods folder
const images = require.context('../../images/gods', false, /\.(png|jpe?g|svg)$/);
const imageMap = images.keys().reduce((acc, item) => {
    const key = item.replace('./', '');
    acc[key] = images(item);
    return acc;
}, {});

const AdminCheatButtons = ({ menuRef, onOpenManagementPanel, handleOpenEvents, onOpenCheats, setIsCheatsMenuOpen }) => (
    <div className="flex flex-row items-center gap-2 absolute top-1/2 -translate-y-1/2 -left-2 -translate-x-full" ref={menuRef}>
        <button onClick={() => { onOpenManagementPanel(); setIsCheatsMenuOpen(false); }} className="p-1.5 bg-gray-800 border border-gray-600 rounded-full hover:bg-gray-700" title="Manager">
            <img src={managerIcon} alt="Manager" className="w-6 h-6 object-contain" />
        </button>
        <button onClick={() => { handleOpenEvents(); setIsCheatsMenuOpen(false); }} className="p-1.5 bg-gray-800 border border-gray-600 rounded-full hover:bg-gray-700" title="Events">
            <img src={eventsIcon} alt="Events" className="w-6 h-6 object-contain" />
        </button>
        <button onClick={() => { onOpenCheats(); setIsCheatsMenuOpen(false); }} className="p-1.5 bg-gray-800 border border-gray-600 rounded-full hover:bg-gray-700" title="Admin Cheats">
            <img src={cheatsIcon} alt="Admin Cheats" className="w-6 h-6 object-contain" />
        </button>
    </div>
);

const WorshipDisplay = ({ 
    godName, playerReligion, worship, buildings, onOpenPowers,
    onOpenSettings, onOpenCheats, onGenerateMap, isGeneratingMap, onOpenManagementPanel, handleOpenEvents
}) => {
    const { userProfile } = useAuth();
    const isAdmin = userProfile?.is_admin;
    const [isCheatsMenuOpen, setIsCheatsMenuOpen] = useState(false);
    const cheatsMenuRef = useRef(null);
    const cheatsButtonRef = useRef(null);

    const getGodDetails = (name, religion) => {
        if (!name || !religion) return null;
        const religionKey = religion.toLowerCase();
        const pantheon = godsConfig[religionKey];
        if (!pantheon) return null;
        return Object.values(pantheon).find(g => g.name === name);
    };

    const godDetails = getGodDetails(godName, playerReligion);

    const favor = godName && worship ? (worship[godName] || 0) : 0;
    const templeLevel = buildings?.temple?.level || 0;
    const maxFavor = templeLevel > 0 ? 100 + (templeLevel * 20) : 0;
    const favorPercentage = maxFavor > 0 ? (favor / maxFavor) * 100 : 0;

    // Effect to close admin menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (cheatsMenuRef.current && !cheatsMenuRef.current.contains(event.target) && cheatsButtonRef.current && !cheatsButtonRef.current.contains(event.target)) {
                setIsCheatsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="worship-display-container">
             <div className="flex justify-around items-center mb-2 relative">
                <button onClick={onOpenSettings} className="p-1" title="Settings">
                    <img src={settingsIcon} alt="Settings" className="w-8 h-8 object-contain" />
                </button>
                <button onClick={onGenerateMap} className="p-1 disabled:opacity-50" disabled={isGeneratingMap} title="Generate World Map Image">
                    <img src={worldMapIcon} alt="World Map" className="w-8 h-8 object-contain"/>
                </button>
                {isAdmin && (
                    <div className="relative">
                        {isCheatsMenuOpen && <AdminCheatButtons 
                            menuRef={cheatsMenuRef}
                            onOpenManagementPanel={onOpenManagementPanel}
                            handleOpenEvents={handleOpenEvents}
                            onOpenCheats={onOpenCheats}
                            setIsCheatsMenuOpen={setIsCheatsMenuOpen}
                        />}
                        <button ref={cheatsButtonRef} onClick={() => setIsCheatsMenuOpen(prev => !prev)} className="p-1" title="Cheats">
                            <img src={cheatsIcon} alt="Cheats" className="w-8 h-8 object-contain" />
                        </button>
                    </div>
                )}
            </div>
            {godName && godDetails ? (
                <div className="text-center flex flex-col items-center">
                    <div className="worship-frame-bg">
                        <div className="favor-progress-ring" style={{ background: `conic-gradient(#4285F4 ${favorPercentage}%, transparent ${favorPercentage}%)` }}>
                            <div className="favor-progress-fill"></div>
                        </div>
                        <img src={imageMap[godDetails.image]} alt={godDetails.name} className="god-avatar" />
                        <div className="favor-plaque">
                            <span className="font-bold">{Math.floor(favor)}</span>
                        </div>
                    </div>
                    <p className="text-lg font-bold mt-2">{godName}</p>
                    <button onClick={onOpenPowers} className="spells-button">
                        <img src={spellsIcon} alt="View Spells" className="w-10 h-10 object-contain"/>
                    </button>
                </div>
            ) : (
                <p className="text-gray-500 text-center text-sm">Build a Temple to worship a god.</p>
            )}
        </div>
    );
};

export default WorshipDisplay;

