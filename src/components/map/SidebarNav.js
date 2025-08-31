// src/components/map/SidebarNav.js
import React from 'react';

const SidebarNav = ({ onToggleView, view, onOpenReports, onOpenAlliance, onOpenMessages, onOpenSettings, onOpenProfile, unreadReportsCount, unreadMessagesCount, isAdmin, onToggleDummyCityPlacement, onOpenForum, onOpenLeaderboard, onOpenQuests, onOpenCheats, isAllianceMember, handleOpenEvents, onOpenHeroesAltar, onOpenManagementPanel, onGenerateMap, isGeneratingMap }) => {
    
    const NavButton = ({ icon, text, onClick, notificationCount, glowing, disabled, title }) => (
        <button 
            onClick={onClick} 
            className={`sidebar-button ${glowing ? 'glowing-border' : ''}`}
            disabled={disabled}
            title={title}
        >
            <div className="icon-container">{icon}</div>
            <span className="button-text">{text}</span>
            {notificationCount > 0 && (
                <span className="notification-badge">
                    {notificationCount}
                </span>
            )}
        </button>
    );
    
    return (
        <div className="sidebar" onMouseDown={(e) => e.stopPropagation()}>
           <NavButton icon="🗺️" text={view === 'map' ? 'City View' : 'Map View'} onClick={() => onToggleView()} />
            
            <NavButton icon="📜" text="Reports" onClick={onOpenReports} notificationCount={unreadReportsCount} glowing={unreadReportsCount > 0} />
            <NavButton icon="🏛️" text="Alliance" onClick={onOpenAlliance} />
            <NavButton 
                icon="🖋️" 
                text="Forum" 
                onClick={onOpenForum} 
                disabled={!isAllianceMember}
                title={!isAllianceMember ? "You must be in an alliance to access the forum" : "Forum"}
            />
            <NavButton icon="✉️" text="Messages" onClick={onOpenMessages} notificationCount={unreadMessagesCount} glowing={unreadMessagesCount > 0} />
            <NavButton icon="🏆" text="Leaderboard" onClick={onOpenLeaderboard} />
            <NavButton icon="👤" text="Profile" onClick={() => onOpenProfile()} />
            <NavButton icon="📊" text="Manager" onClick={onOpenManagementPanel} />
            <NavButton icon="🌍" text="World Map" onClick={onGenerateMap} disabled={isGeneratingMap} title="Generate World Map Image" />
            <NavButton icon="⚙️" text="Settings" onClick={onOpenSettings} />
            {isAdmin && (
                <>
                    {view === 'city' && <NavButton icon="🔧" text="Admin Cheats" onClick={onOpenCheats} />}
                    <NavButton icon="✨" text="Events" onClick={handleOpenEvents} />
                    {view === 'map' && (
                        <button onClick={onToggleDummyCityPlacement} className="sidebar-button bg-yellow-700 hover:bg-yellow-600">
                             <div className="icon-container">👑</div>
                             <span className="button-text">Place Dummy</span>
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default SidebarNav;
