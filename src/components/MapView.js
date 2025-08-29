// src/components/MapView.js
import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useAlliance } from '../contexts/AllianceContext';
import { db } from '../firebase/config';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import SidebarNav from './map/SidebarNav';
import TopBar from './map/TopBar';
import MapModals from './map/MapModals';
import SideInfoPanel from './SideInfoPanel';
import DivinePowers from './city/DivinePowers';
import QuestsButton from './QuestsButton';
import WithdrawModal from './city/WithdrawModal';
import WonderBuilderModal from './alliance/WonderBuilderModal';
import WonderProgressModal from './alliance/WonderProgressModal';
import Modal from './shared/Modal';
import allianceWonders from '../gameData/alliance_wonders.json';
import { useMapActions } from '../hooks/useMapActions';
import { useCityState } from '../hooks/useCityState';
import { useMapClickHandler } from '../hooks/useMapClickHandler';
import PhaserMap from './map/PhaserMappls'; // Import the new PhaserMap component

const MapView = ({
    showCity,
    openModal,
    closeModal,
    modalState,
    unreadReportsCount,
    unreadMessagesCount,
    quests,
    handleMessageAction,
    panToCoords,
    setPanToCoords,
    movements,
    onCancelTrain,
    onCancelMovement,
    isUnderAttack,
    incomingAttackCount,
    onRenameCity,
    onGodTownClick,
    handleOpenEvents,
    onSwitchCity,
    battlePoints,
    onOpenManagementPanel,
    onOpenNotes,
}) => {
    const { currentUser, userProfile } = useAuth();
    const { worldState, gameState, setGameState, worldId, playerCity, playerCities, conqueredVillages, conqueredRuins, activeCityId, playerCityPoints } = useGame();
    const { playerAlliance } = useAlliance();
    const viewportRef = useRef(null);
    const [message, setMessage] = useState('');
    const { travelTimeInfo, setTravelTimeInfo, handleSendMovement, handleCreateDummyCity, handleWithdrawTroops, handleFoundCity, handleActionClick } = useMapActions(openModal, closeModal, showCity, () => {}, setMessage);
    const { getFarmCapacity, calculateUsedPopulation, calculateHappiness, getMarketCapacity, getProductionRates, getWarehouseCapacity } = useCityState(worldId);
    const [allCitySlots, setAllCitySlots] = useState({});
    const [godTowns, setGodTowns] = useState({});
    const [villages, setVillages] = useState({});
    const [ruins, setRuins] = useState({});
    const [wreckages, setWreckages] = useState({});
    const [wonderBuilderData, setWonderBuilderData] = useState(null);
    const [wonderProgressData, setWonderProgressData] = useState(null);
    const [wonderInfo, setWonderInfo] = useState(null);
    const [allWonders, setAllWonders] = useState([]);
    const [wonderSpots, setWonderSpots] = useState({});
    const [controlledIslands, setControlledIslands] = useState({});

    const handleEnterCity = (cityId) => {
        onSwitchCity(cityId);
        showCity();
        closeModal('city');
    };

    const { onCitySlotClick, onVillageClick, onRuinClick, onWreckageClick } = useMapClickHandler({
        playerCity,
        isPlacingDummyCity: false, 
        handleCreateDummyCity,
        setTravelTimeInfo,
        openModal,
        closeModal,
        setMessage,
        conqueredVillages,
        conqueredRuins,
        cityGameState: gameState,
        viewportRef,
    });
    
    useEffect(() => {
        if (!worldId) return;
        const citySlotsRef = collection(db, 'worlds', worldId, 'citySlots');
        const unsubCities = onSnapshot(citySlotsRef, (snapshot) => {
            const slots = {};
            snapshot.forEach(doc => {
                slots[doc.id] = { id: doc.id, ...doc.data() };
            });
            setAllCitySlots(slots);
        });

        const godTownsRef = collection(db, 'worlds', worldId, 'godTowns');
        const unsubGodTowns = onSnapshot(godTownsRef, (snapshot) => {
            const towns = {};
            snapshot.forEach(doc => {
                towns[doc.id] = { id: doc.id, ...doc.data() };
            });
            setGodTowns(towns);
        });
        
        const villagesRef = collection(db, 'worlds', worldId, 'villages');
        const unsubVillages = onSnapshot(villagesRef, (snapshot) => {
            const vills = {};
            snapshot.forEach(doc => {
                vills[doc.id] = { id: doc.id, ...doc.data() };
            });
            setVillages(vills);
        });

        const ruinsRef = collection(db, 'worlds', worldId, 'ruins');
        const unsubRuins = onSnapshot(ruinsRef, (snapshot) => {
            const rns = {};
            snapshot.forEach(doc => {
                rns[doc.id] = { id: doc.id, ...doc.data() };
            });
            setRuins(rns);
        });

        const wreckagesRef = collection(db, 'worlds', worldId, 'wreckages');
        const unsubWreckages = onSnapshot(wreckagesRef, (snapshot) => {
            const wrecks = {};
            snapshot.forEach(doc => {
                wrecks[doc.id] = { id: doc.id, ...doc.data() };
            });
            setWreckages(wrecks);
        });

        const wondersQuery = query(collection(db, 'worlds', worldId, 'alliances'), where('allianceWonder', '!=', null));
        const unsubWonders = onSnapshot(wondersQuery, (snapshot) => {
            const wonders = snapshot.docs.map(doc => ({
                ...doc.data().allianceWonder,
                allianceName: doc.data().name,
                allianceTag: doc.data().tag,
                allianceId: doc.id
            }));
            setAllWonders(wonders);
        });

        return () => {
            unsubCities();
            unsubGodTowns();
            unsubVillages();
            unsubRuins();
            unsubWreckages();
            unsubWonders();
        };
    }, [worldId]);
    
    const combinedSlots = useMemo(() => {
        const newSlots = { ...allCitySlots };
        for (const cityId in playerCities) {
            const pCity = playerCities[cityId];
            if (pCity && pCity.slotId) {
                newSlots[pCity.slotId] = {
                    ...newSlots[pCity.slotId],
                    ...pCity,
                    ownerId: currentUser.uid,
                    ownerUsername: userProfile.username
                };
            }
        }
        return newSlots;
    }, [allCitySlots, playerCities, currentUser.uid, userProfile.username]);

    const handleOpenAlliance = () => openModal('alliance');
    
    const { availablePopulation, happiness, marketCapacity } = useMemo(() => {
        if (!gameState?.buildings) return { availablePopulation: 0, happiness: 0, marketCapacity: 0 };
        const maxPop = getFarmCapacity(gameState.buildings.farm?.level);
        const usedPop = calculateUsedPopulation(gameState);
        const availablePop = maxPop - usedPop;
        const happinessValue = calculateHappiness(gameState.buildings);
        const marketCap = getMarketCapacity(gameState.buildings.market?.level);
        return { availablePopulation: availablePop, happiness: happinessValue, marketCapacity: marketCap };
    }, [gameState, getFarmCapacity, calculateUsedPopulation, calculateHappiness, getMarketCapacity]);
    
    const productionRates = useMemo(() => {
        if (!gameState) return { wood: 0, stone: 0, silver: 0 };
        return getProductionRates(gameState.buildings);
    }, [gameState, getProductionRates]);

    // # Logic to find wonder spots
    useEffect(() => {
        if (!worldState?.islands || !allCitySlots || !villages) return;

        const newSpots = {};
        worldState.islands.forEach(island => {
            if (allWonders.some(w => w.islandId === island.id)) return;
            const centerX = Math.round(island.x);
            const centerY = Math.round(island.y);
            const spot = { x: centerX, y: centerY, islandId: island.id };
            newSpots[island.id] = spot;
        });
        setWonderSpots(newSpots);
    }, [worldState, allCitySlots, villages, allWonders]);

     // # Wonder click handlers
    const handleWonderSpotClick = (spotData) => {
        if (playerAlliance?.leader?.uid !== currentUser.uid) {
            setMessage("Only the alliance leader can begin construction of a wonder.");
            return;
        }
        if (playerAlliance.allianceWonder) {
            setMessage("Your alliance is already building a wonder elsewhere.");
            return;
        }
        setWonderBuilderData({ islandId: spotData.islandId, coords: { x: spotData.x, y: spotData.y } });
    };

    const handleConstructingWonderClick = (wonderData) => {
        if (playerAlliance && playerAlliance.id === wonderData.allianceId) {
            setWonderProgressData(wonderData);
        } else {
            const wonderConfig = allianceWonders[wonderData.id];
            setWonderInfo({
                title: wonderConfig.name,
                message: `Level ${wonderData.level}. Being built by ${wonderData.allianceName} [${wonderData.allianceTag}].`
            });
        }
    };


    return (
        <div className="w-full h-screen flex flex-col bg-gray-900 map-view-wrapper relative">
            <QuestsButton
                onOpenQuests={() => openModal('quests')}
                quests={quests}
            />
            <div className="flex-grow flex flex-row overflow-visible">
                 <SidebarNav
                    onToggleView={showCity}
                    view="map"
                    onOpenReports={() => openModal('reports')}
                    onOpenAlliance={handleOpenAlliance}
                    onOpenForum={() => openModal('allianceForum')}
                    onOpenMessages={() => openModal('messages')}
                    onOpenSettings={() => openModal('settings')}
                    onOpenProfile={() => openModal('profile')}
                    onOpenLeaderboard={() => openModal('leaderboard')}
                    onOpenQuests={() => openModal('quests')}
                    unreadReportsCount={unreadReportsCount}
                    unreadMessagesCount={unreadMessagesCount}
                    isAdmin={userProfile?.is_admin}
                    onToggleDummyCityPlacement={() => {}}
                    isAllianceMember={!!playerAlliance}
                    handleOpenEvents={handleOpenEvents}
                    onOpenManagementPanel={onOpenManagementPanel}
                />
                <div className="main-content flex-grow relative map-surface">
                    <TopBar
                        view="map"
                        gameState={gameState}
                        availablePopulation={availablePopulation}
                        happiness={happiness}
                        worldState={worldState}
                        productionRates={productionRates}
                        getWarehouseCapacity={getWarehouseCapacity}
                        movements={movements}
                        onCancelTrain={onCancelTrain}
                        onCancelMovement={onCancelMovement}
                        combinedSlots={combinedSlots}
                        onOpenMovements={() => openModal('movements')}
                        isUnderAttack={isUnderAttack}
                        incomingAttackCount={incomingAttackCount}
                        onRenameCity={onRenameCity}
                        onSwitchCity={onSwitchCity}
                        battlePoints={battlePoints}
                        onOpenNotes={onOpenNotes}
                    />
                    <SideInfoPanel gameState={playerCity} className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20 flex flex-col gap-4" onOpenPowers={() => openModal('divinePowers')} movements={movements} />
                    
                    <div className="map-viewport absolute inset-0" ref={viewportRef}>
                       {(worldState && combinedSlots) && (
                            <PhaserMap
                                worldState={worldState}
                                combinedSlots={combinedSlots}
                                villages={villages}
                                ruins={ruins}
                                godTowns={godTowns}
                                playerAlliance={playerAlliance}
                                conqueredVillages={conqueredVillages}
                                cityPoints={playerCityPoints}
                                scoutedCities={{}}
                                wonderSpots={wonderSpots}
                                allWonders={allWonders}
                                visibleWreckages={wreckages}
                                movements={movements}
                                onCitySlotClick={onCitySlotClick}
                                onVillageClick={onVillageClick}
                                onRuinClick={onRuinClick}
                                onWreckageClick={onWreckageClick}
                                onGodTownClick={onGodTownClick}
                                onWonderSpotClick={handleWonderSpotClick}
                                onConstructingWonderClick={handleConstructingWonderClick}
                                panToCoords={panToCoords}
                            />
                       )}
                    </div>
                </div>
            </div>
            {message && <Modal message={message} onClose={() => setMessage('')} />}
            {wonderInfo && <Modal title={wonderInfo.title} message={wonderInfo.message} onClose={() => setWonderInfo(null)} />}
            <MapModals
                modalState={modalState}
                closeModal={closeModal}
                gameState={gameState}
                playerCity={playerCity}
                travelTimeInfo={travelTimeInfo}
                handleSendMovement={handleSendMovement}
                handleCancelMovement={onCancelMovement}
                setMessage={setMessage}
                goToCoordinates={(x, y) => setPanToCoords({x, y})}
                handleActionClick={handleActionClick}
                worldId={worldId}
                movements={movements}
                combinedSlots={combinedSlots}
                villages={villages}
                userProfile={userProfile}
                onCastSpell={() => {}}
                onActionClick={handleMessageAction}
                marketCapacity={marketCapacity}
                onEnterCity={handleEnterCity}
                onSwitchCity={onSwitchCity}
                onWithdraw={(city) => openModal('withdraw', city)}
                onFoundCity={handleFoundCity}
            />
             {modalState.isDivinePowersOpen && <DivinePowers godName={gameState.god} playerReligion={gameState.playerInfo.religion} favor={gameState.worship[gameState.god] || 0} onCastSpell={() => {}} onClose={() => closeModal('divinePowers')} targetType={modalState.divinePowersTarget ? 'other' : 'self'} />}
             {modalState.isWithdrawModalOpen && (
                <WithdrawModal
                    city={modalState.withdrawModalData}
                    onClose={() => closeModal('withdraw')}
                    onWithdrawTroops={handleWithdrawTroops}
                />
            )}
            {wonderBuilderData && <WonderBuilderModal onClose={() => setWonderBuilderData(null)} {...wonderBuilderData} />}
            {wonderProgressData && <WonderProgressModal onClose={() => setWonderProgressData(null)} />}
        </div>
    );
};
export default MapView;

