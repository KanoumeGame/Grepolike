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

const SidebarNav = ({ onToggleView, view, onOpenReports, onOpenAlliance, onOpenMessages, onOpenProfile, unreadReportsCount, unreadMessagesCount, isAdmin, onToggleDummyCityPlacement, onOpenForum, onOpenLeaderboard, isAllianceMember, handleOpenEvents, onOpenManagementPanel }) => {
    
    const [isNavOpen, setIsNavOpen] = useState(true);
    const [setIsAdminMenuOpen] = useState(false);
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
