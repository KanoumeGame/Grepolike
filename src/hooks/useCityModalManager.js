/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
// src/hooks/useCityModalManager.js
import { useState } from 'react';

/**
 * Manages the state of all modals within the CityView.
 */
export const useCityModalManager = () => {
    const [modalState, setModalState] = useState({
        selectedBuildingId: null,
        isSenateViewOpen: false,
        isBarracksMenuOpen: false,
        isShipyardMenuOpen: false,
        isTempleMenuOpen: false,
        isDivineTempleMenuOpen: false,
        isCaveMenuOpen: false,
        isAcademyMenuOpen: false,
        isHospitalMenuOpen: false,
        isCheatMenuOpen: false,
        isDivinePowersOpen: false,
        isMarketMenuOpen: false,
        isSpecialBuildingMenuOpen: false,
        isSpecialBuildingPanelOpen: false, //  Add state for the new panel
        isHeroesAltarOpen: false,
        isWorkerPresetPanelOpen: false,
        isPrisonMenuOpen: false, //  Add state for the prison menu
        isTaskGiverOpen: false, // Added for task giver
        taskGiverNpc: null, // Added to hold NPC data
    });

    const openModal = (modalKey, data = null) => {
        const update = { [modalKey]: true };
        if (modalKey === 'isTaskGiverOpen') {
            update.taskGiverNpc = data;
        }
        setModalState(prev => ({ ...prev, ...update }));
    };

    const closeModal = (modalKey) => {
        const update = { [modalKey]: false, selectedBuildingId: null };
         if (modalKey === 'isTaskGiverOpen') {
            update.taskGiverNpc = null;
        }
        setModalState(prev => ({ ...prev, ...update }));
    };

    return { modalState, setModalState, openModal, closeModal };
};
