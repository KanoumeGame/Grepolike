// src/hooks/useMapClickHandler.js
import { calculateDistance } from '../utils/travel';
import { getVillageTroops } from '../utils/combat';

export const useMapClickHandler = ({
    playerCity,
    isPlacingDummyCity,
    handleCreateDummyCity,
    setTravelTimeInfo,
    openModal,
    closeModal,
    setMessage,
    conqueredVillages,
    conqueredRuins,
    cityGameState,
    viewportRef,
}) => {

    const onCitySlotClick = (e, slotData) => {
        console.log("onCitySlotClick triggered. slotData:", slotData);
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('village');
        if (isPlacingDummyCity && !slotData.ownerId) {
            handleCreateDummyCity(slotData.id, slotData);
            return;
        }
        if (slotData.ownerId) {
             const distance = calculateDistance(playerCity, slotData);
             setTravelTimeInfo({ distance });
            const cityData = slotData;
            let position;
            if (e && e.currentTarget) {
                const rect = e.currentTarget.getBoundingClientRect();
                position = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                };
            } else if (viewportRef && viewportRef.current) {
                const rect = viewportRef.current.getBoundingClientRect();
                position = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                };
            } else {
                position = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            }
            const modalData = { ...cityData, position };
            openModal('city', modalData);
        } else {
            if (!cityGameState) {
                setMessage("You must have an active city to found a new one. Please select one from the top bar.");
                return;
            }
            const hasArchitect = cityGameState.agents?.architect > 0;
            if (hasArchitect) {
                openModal('emptyCity', slotData);
            } else {
                setMessage('You need an Architect to found a new city. Recruit one at the Heroes Altar.');
            }
        }
    };

    const onVillageClick = (e, villageData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('city');
        if (playerCity.islandId !== villageData.islandId) {
            setMessage("You can only interact with villages on islands where you have a city.");
            return;
        }
        const isConqueredByPlayer = conqueredVillages && conqueredVillages[villageData.id];
        if (isConqueredByPlayer) {
            openModal('village', { ...villageData, ...conqueredVillages[villageData.id] });
        } else {
            const distance = calculateDistance(playerCity, villageData);
            setTravelTimeInfo({ distance });
            const targetData = {
                id: villageData.id,
                name: villageData.name,
                cityName: villageData.name,
                ownerId: null,
                ownerUsername: 'Neutral',
                x: villageData.x,
                y: villageData.y,
                islandId: villageData.islandId,
                isVillageTarget: true,
                troops: getVillageTroops(villageData),
                level: villageData.level || 1,
                demands: villageData.demands,
                supplies: villageData.supplies,
                tradeRatio: villageData.tradeRatio
            };
            openModal('city', targetData);
        }
    };

    const onRuinClick = (e, ruinData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('city');
        closeModal('village');
        const distance = calculateDistance(playerCity, ruinData);
        setTravelTimeInfo({ distance });
        const isConqueredByYou = conqueredRuins && conqueredRuins[ruinData.id];
        const targetData = {
            id: ruinData.id,
            name: ruinData.name,
            cityName: ruinData.name,
            ownerId: ruinData.ownerId || 'ruins',
            ownerUsername: ruinData.ownerUsername || 'Ancient Guardians',
            x: ruinData.x,
            y: ruinData.y,
            isRuinTarget: true,
            troops: ruinData.troops,
            researchReward: ruinData.researchReward,
            isConqueredByYou: !!isConqueredByYou
        };
        openModal('city', targetData);
    };

    return { onCitySlotClick, onVillageClick, onRuinClick };
};
