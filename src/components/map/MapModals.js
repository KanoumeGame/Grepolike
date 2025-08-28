// src/components/map/MapModals.js
import React, { useMemo } from 'react';
import RadialMenu from './RadialMenu';
import OtherCityModal from './OtherCityModal';
import FarmingVillageModal from './FarmingVillageModal';
import MovementModal from './MovementModal';
import MovementsPanel from './MovementsPanel';
import ReinforcementModal from '../city/ReinforcementModal';
import { useAuth } from '../../contexts/AuthContext';
import EmptyCityModal from './EmptyCityModal';
import RescueModal from './RescueModal';

const MapModals = ({
    modalState,
    closeModal,
    gameState,
    playerCity,
    travelTimeInfo,
    handleSendMovement,
    handleCancelMovement,
    setMessage,
    goToCoordinates,
    handleActionClick,
    worldId,
    movements,
    combinedSlots,
    villages,
    handleRushMovement,
    userProfile,
    onCastSpell,
    onActionClick,
    marketCapacity,
    onEnterCity,
    onSwitchCity,
    onWithdraw,
    onFoundCity,
}) => {
    const { currentUser } = useAuth();
    const { selectedCity } = modalState;

    const canWithdraw = useMemo(() => {
        if (!selectedCity || !selectedCity.reinforcements) return false;
        return Object.values(selectedCity.reinforcements).some(reinf => reinf.ownerId === currentUser.uid);
    }, [selectedCity, currentUser.uid]);


    const renderCityInteraction = () => {
        if (!selectedCity) return null;

        console.log("Selected City in MapModals:", selectedCity);

        if (selectedCity.isRuinTarget || selectedCity.isVillageTarget) {
            return (
                <OtherCityModal
                    city={selectedCity}
                    playerCity={playerCity}
                    travelTimeInfo={travelTimeInfo}
                    onSendMovement={handleSendMovement}
                    onClose={() => closeModal('city')}
                    onAction={handleActionClick}
                    onGoTo={goToCoordinates}
                    gameState={gameState}
                    onCastSpell={onCastSpell}
                    isVillageTarget={selectedCity.isVillageTarget}
                />
            );
        }

        const isOwn = selectedCity.ownerId === currentUser.uid;
        const isActive = gameState?.id === selectedCity.id;
        const hasReinforcements = selectedCity.reinforcements && Object.keys(selectedCity.reinforcements).length > 0;

        let allActions = [];
        if (isOwn) {
            if (isActive) {
                allActions = [
                    { label: 'Enter City', icon: '🏛️', handler: () => onEnterCity(selectedCity.id) },
                    { label: 'Center on Map', icon: '📍', handler: () => goToCoordinates(selectedCity.x, selectedCity.y) },
                ];
                if (hasReinforcements) {
                    allActions.push({ label: 'Withdraw Troops', icon: '🛡️', handler: () => onWithdraw(selectedCity) });
                }
            } else {
                allActions = [
                    { label: 'Enter City', icon: '🏛️', handler: () => onEnterCity(selectedCity.id) },
                    { label: 'Select City', icon: '✅', handler: () => onSwitchCity(selectedCity.id) },
                    { label: 'Reinforce', icon: '🛡️', handler: () => handleActionClick('reinforce', selectedCity) },
                    { label: 'Trade', icon: '⚖️', handler: () => handleActionClick('trade', selectedCity) },
                    ...(hasReinforcements ? [{ label: 'Withdraw Troops', icon: '🛡️', handler: () => onWithdraw(selectedCity) }] : []),
                    { label: 'Center on Map', icon: '📍', handler: () => goToCoordinates(selectedCity.x, selectedCity.y) },
                ];
            }
        } else {
            allActions = [
                { label: 'Attack', icon: '⚔️', handler: () => handleActionClick('attack', selectedCity) },
                { label: 'Reinforce', icon: '🛡️', handler: () => handleActionClick('reinforce', selectedCity) },
                { label: 'Scout', icon: '👁️', handler: () => handleActionClick('scout', selectedCity) },
                { label: 'Trade', icon: '⚖️', handler: () => handleActionClick('trade', selectedCity) },
                { label: 'Cast Spell', icon: '✨', handler: () => handleActionClick('castSpell', selectedCity) },
                { label: 'Profile', icon: '👤', handler: () => handleActionClick('profile', selectedCity) },
            ];
            if (canWithdraw) {
                allActions.push({ label: 'Withdraw Troops', icon: '🛡️', handler: () => onWithdraw(selectedCity) });
            }
            const canRescue = selectedCity.capturedHero && selectedCity.capturedHero[1] === currentUser.uid;
            console.log("Can Rescue Check:", {
                capturedHero: selectedCity.capturedHero,
                currentUserId: currentUser.uid,
                result: canRescue
            });
            if (canRescue) {
                allActions.push({ label: 'Rescue Hero', icon: '🗝️', handler: () => handleActionClick('rescue', selectedCity) });
            }
        }

        const centerAction = allActions.find(a => a.label === 'Select City');
        const radialActions = allActions.filter(a => a.label !== 'Select City');

        return (
            <RadialMenu
                actions={radialActions}
                centerAction={centerAction}
                position={selectedCity.position}
                onClose={() => closeModal('city')}
            />
        );
    };

    return (
        <>
            {renderCityInteraction()}
            {modalState.selectedVillage && (
                <FarmingVillageModal
                    village={modalState.selectedVillage}
                    onClose={() => closeModal('village')}
                    onActionClick={handleActionClick}
                    playerCity={playerCity}
                    worldId={worldId}
                    marketCapacity={marketCapacity}
                />
            )}
            {modalState.actionDetails && (
                <MovementModal
                    mode={modalState.actionDetails.mode}
                    targetCity={modalState.actionDetails.city}
                    onClose={() => closeModal('action')}
                    onSend={handleSendMovement}
                    playerCity={playerCity}
                    gameState={gameState}
                    travelTimeInfo={travelTimeInfo}
                    setMessage={setMessage}
                    movements={movements}
                />
            )}
            {modalState.isMovementsPanelOpen && (
                <MovementsPanel
                    movements={movements}
                    onClose={() => closeModal('movements')}
                    combinedSlots={combinedSlots}
                    villages={villages}
                    goToCoordinates={goToCoordinates}
                    onCancel={handleCancelMovement}
                    onRush={handleRushMovement}
                    userProfile={userProfile}
                />
            )}
            {modalState.isReinforcementsModalOpen && (
                <ReinforcementModal
                    city={modalState.reinforcementsModalData}
                    onClose={() => closeModal('reinforcements')}
                    onOpenWithdraw={onWithdraw}
                />
            )}
            {modalState.isEmptyCityModalOpen && (
                <EmptyCityModal
                    plot={modalState.emptyCityModalData}
                    onClose={() => closeModal('emptyCity')}
                    onFoundCity={onFoundCity}
                    cityGameState={gameState}
                />
            )}
            {modalState.isRescueModalOpen && (
                 <RescueModal
                    targetCity={modalState.rescueModalData}
                    onClose={() => closeModal('rescue')}
                    onSend={handleSendMovement}
                    setMessage={setMessage}
                />
            )}
        </>
    );
};

export default MapModals;
