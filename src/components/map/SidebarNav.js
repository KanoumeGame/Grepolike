// src/components/map/SidebarNav.js
import React, { useState, useRef, useEffect } from 'react';
import mapViewIcon from '../../images/ui/map_view.png';
import cityViewIcon from '../../images/ui/city_view.png';
import reportsIcon from '../../images/ui/reports.png';
import allianceIcon from '../../images/ui/alliance.png';
import forumIcon from '../../images/ui/forum.png';
import messagesIcon from '../../images/ui/messages.png';
import leaderboardIcon from '../../images/ui/leaderboard.png';
import profileIcon from '../../images/ui/profile.png';
import managerIcon from '../../images/ui/manager.png';
import worldMapIcon from '../../images/ui/world_map.png';
import settingsIcon from '../../images/ui/settings.png';
import cheatsIcon from '../../images/ui/cheats.png';
import eventsIcon from '../../images/ui/events.png';
import dummyIcon from '../../images/ui/dummy.png';

const SidebarNav = ({ onToggleView, view, onOpenReports, onOpenAlliance, onOpenMessages, onOpenSettings, onOpenProfile, unreadReportsCount, unreadMessagesCount, isAdmin, onToggleDummyCityPlacement, onOpenForum, onOpenLeaderboard, onOpenQuests, onOpenCheats, isAllianceMember, handleOpenEvents, onOpenHeroesAltar, onOpenManagementPanel, onGenerateMap, isGeneratingMap }) => {
    
    const [isNavOpen, setIsNavOpen] = useState(true);
    const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
    const adminMenuRef = useRef(null);

    const NavButton = ({ imgSrc, text, onClick, notificationCount, glowing, disabled, title }) => (
        <button 
            onClick={onClick} 
            className={`sidebar-button ${glowing ? 'glowing-border' : ''}`}
            disabled={disabled}
            title={title}
        >
            <img src={imgSrc} alt={text} className="w-8 h-8 object-contain" />
            <span className="button-text">{text}</span>
            {notificationCount > 0 && (
                <span className="notification-badge">
                    {notificationCount}
                </span>
            )}
        </button>
    );

    // Effect to close admin menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
                setIsAdminMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [adminMenuRef]);
    
    return (
        <>
            <div className={`sidebar ${isNavOpen ? 'open' : 'closed'}`} onMouseDown={(e) => e.stopPropagation()}>
               <NavButton imgSrc={view === 'map' ? cityViewIcon : mapViewIcon} text={view === 'map' ? 'City View' : 'Map View'} onClick={() => onToggleView()} />
                
                <NavButton imgSrc={reportsIcon} text="Reports" onClick={onOpenReports} notificationCount={unreadReportsCount} glowing={unreadReportsCount > 0} />
                <NavButton imgSrc={allianceIcon} text="Alliance" onClick={onOpenAlliance} />
                <NavButton 
                    imgSrc={forumIcon} 
                    text="Forum" 
                    onClick={onOpenForum} 
                    disabled={!isAllianceMember}
                    title={!isAllianceMember ? "You must be in an alliance to access the forum" : "Forum"}
                />
                <NavButton imgSrc={messagesIcon} text="Messages" onClick={onOpenMessages} notificationCount={unreadMessagesCount} glowing={unreadMessagesCount > 0} />
                <NavButton imgSrc={leaderboardIcon} text="Leaderboard" onClick={onOpenLeaderboard} />
                <NavButton imgSrc={profileIcon} text="Profile" onClick={() => onOpenProfile()} />
                <NavButton imgSrc={worldMapIcon} text="World Map" onClick={onGenerateMap} disabled={isGeneratingMap} title="Generate World Map Image" />
                <NavButton imgSrc={settingsIcon} text="Settings" onClick={onOpenSettings} />
                {isAdmin && (
                    <div ref={adminMenuRef} className="relative">
                        <NavButton imgSrc={cheatsIcon} text="Admin" onClick={() => setIsAdminMenuOpen(prev => !prev)} />
                        {isAdminMenuOpen && (
                            <div className="absolute left-full top-0 ml-2 p-2 rounded-md bg-gray-800 border border-gray-600 w-48 shadow-lg flex flex-col gap-1">
                                <button onClick={() => { onOpenManagementPanel(); setIsAdminMenuOpen(false); }} className="sidebar-button">
                                    <img src={managerIcon} alt="Manager" className="w-8 h-8 object-contain" />
                                    <span className="button-text">Manager</span>
                                </button>
                                <button onClick={() => { handleOpenEvents(); setIsAdminMenuOpen(false); }} className="sidebar-button">
                                    <img src={eventsIcon} alt="Events" className="w-8 h-8 object-contain" />
                                    <span className="button-text">Events</span>
                                </button>
                                <button onClick={() => { onOpenCheats(); setIsAdminMenuOpen(false); }} disabled={view !== 'city'} className="sidebar-button" title={view !== 'city' ? "Available in City View only" : "Open City Cheats"}>
                                    <img src={cheatsIcon} alt="City Cheats" className="w-8 h-8 object-contain" />
                                    <span className="button-text">City Cheats</span>
                                </button>
                                <button onClick={() => { onToggleDummyCityPlacement(); setIsAdminMenuOpen(false); }} disabled={view !== 'map'} className="sidebar-button" title={view !== 'map' ? "Available in Map View only" : "Place Dummy City"}>
                                     <img src={dummyIcon} alt="Place Dummy" className="w-8 h-8 object-contain" />
                                     <span className="button-text">Place Dummy</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <button 
                onClick={() => setIsNavOpen(!isNavOpen)} 
                className="sidebar-toggle-button"
                title={isNavOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
            >
                {isNavOpen ? '«' : '»'}
            </button>
        </>
    );
};

export default SidebarNav;

