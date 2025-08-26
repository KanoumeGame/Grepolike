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
 *  Manages the state of all modals within the CityView.
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
    });

    const openModal = (modalKey) => setModalState(prev => ({ ...prev, [modalKey]: true }));
    const closeModal = (modalKey) => setModalState(prev => ({ ...prev, [modalKey]: false, selectedBuildingId: null }));

    return { modalState, setModalState, openModal, closeModal };
};
