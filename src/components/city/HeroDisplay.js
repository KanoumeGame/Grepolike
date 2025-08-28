import React, { useState } from 'react';
import heroesConfig from '../../gameData/heroes.json';
import agentsConfig from '../../gameData/agents.json';
import './HeroDisplay.css';
import Countdown from '../map/Countdown'; //  Import Countdown component
import FreeHeroModal from './FreeHeroModal';
import { useAuth } from '../../contexts/AuthContext';

const heroImages = {};
const heroImageContext = require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/);
heroImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    heroImages[key] = heroImageContext(item);
});

const agentImages = {};
const agentImageContext = require.context('../../images/agents', false, /\.(png|jpe?g|svg)$/);
agentImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    agentImages[key] = agentImageContext(item);
});

const HeroDisplay = ({ heroes, agents, movements, activeCityId, onSendLiberator, combinedSlots }) => {
    const [heroToFree, setHeroToFree] = useState(null);
    const { currentUser } = useAuth();

    const handleHeroClick = (heroId, heroData) => {
        if (heroData.capturedIn) {
            const capturedInSlotId = heroData.capturedIn;
            const targetCityData = combinedSlots[capturedInSlotId];
            if (targetCityData) {
                setHeroToFree({ heroId, ownerId: currentUser.uid, targetCityData });
            } else {
                console.error("Could not find data for the capturing city.");
            }
        }
    };

    //  Show all active heroes that are assigned to a city, captured, or currently in a movement.
    const heroesToShow = Object.keys(heroes || {}).filter(heroId => {
        const hero = heroes[heroId];
        const isTraveling = (movements || []).some(m => m.hero === heroId);
        return hero.active && (hero.cityId || hero.capturedIn || isTraveling);
    });
    const recruitedAgents = Object.keys(agents || {}).filter(agentId => agents[agentId] > 0);

    if (heroesToShow.length === 0 && recruitedAgents.length === 0) {
        return null;
    }

    return (
        <div className="hero-display-container">
            <h3 className="hero-display-header">Heroes & Agents</h3>
            <div className="heroes-grid">
                {heroesToShow.map(heroId => {
                    const hero = heroesConfig[heroId];
                    const heroData = heroes[heroId];
                    const isCaptured = !!heroData?.capturedIn;
                    const heroMovement = (movements || []).find(m => m.hero === heroId);
                    const isAway = heroData?.cityId && heroData.cityId !== activeCityId && !isCaptured && !heroMovement;

                    const woundedUntilDate = heroData.woundedUntil?.toDate ? heroData.woundedUntil.toDate() : (heroData.woundedUntil ? new Date(heroData.woundedUntil) : null);
                    const isWounded = woundedUntilDate && woundedUntilDate > new Date();

                    let statusTitle = hero.name;
                    let overlay = null;
                    let customClass = '';
                    let backgroundClass = '';
                    let onClickHandler = null;

                    if (isCaptured) {
                        statusTitle = `${hero.name} (Captured) - Click to attempt rescue`;
                        overlay = <div className="captured-bars-overlay"></div>;
                        customClass = 'opacity-50 cursor-pointer';
                        onClickHandler = () => handleHeroClick(heroId, heroData);
                    } else if (isWounded) {
                        statusTitle = `${hero.name} (Wounded)`;
                        backgroundClass = 'bg-red-500/50';
                        customClass = 'opacity-60';
                        //  Add a wounded overlay with a countdown timer
                        overlay = (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-xs font-bold">
                                <span>Wounded</span>
                                <Countdown arrivalTime={heroData.woundedUntil} />
                            </div>
                        );
                    } else if (heroMovement) {
                        statusTitle = `${hero.name} (Traveling)`;
                        overlay = <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl">✈️</span>;
                        customClass = 'opacity-50';
                    } else if (isAway) {
                        statusTitle = `${hero.name} (Away)`;
                        customClass = 'opacity-50 grayscale';
                    }

                    return (
                        <div key={heroId} className={`hero-item relative ${backgroundClass}`} title={statusTitle} onClick={onClickHandler}>
                            <img src={heroImages[hero.image]} alt={hero.name} className={customClass} />
                            {overlay}
                        </div>
                    );
                })}
                {recruitedAgents.map(agentId => {
                    const agent = agentsConfig[agentId];
                    const agentCount = agents[agentId];
                    return (
                        <div key={agentId} className="hero-item" title={`${agent.name} (x${agentCount})`}>
                            <img src={agentImages[agent.image]} alt={agent.name} />
                            <span className="troop-count">{agentCount}</span>
                        </div>
                    );
                })}
            </div>
            {heroToFree && (
                <FreeHeroModal
                    hero={heroToFree}
                    onClose={() => setHeroToFree(null)}
                    onSend={onSendLiberator}
                />
            )}
        </div>
    );
};

export default HeroDisplay;
