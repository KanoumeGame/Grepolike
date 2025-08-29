import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

// # handles reinforcement arrivals
export const processReinforceMovement = async (movement, movementDoc, worldId, targetCityRef) => {
    const targetCitySlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);
    
    await runTransaction(db, async (transaction) => {
        const targetCitySnap = await transaction.get(targetCityRef);
        const targetCitySlotSnap = await transaction.get(targetCitySlotRef);
        if (!targetCitySnap.exists() || !targetCitySlotSnap.exists()) {
            throw new Error("Target city or slot data not found.");
        }

        const currentCityState = targetCitySnap.data();
        const newReinforcements = { ...(currentCityState.reinforcements || {}) };
        const originCityId = movement.originCityId;

        if (!newReinforcements[originCityId]) {
            newReinforcements[originCityId] = {
                ownerId: movement.originOwnerId,
                originCityName: movement.originCityName,
                units: {},
            };
        }

        for (const unitId in movement.units) {
            newReinforcements[originCityId].units[unitId] = (newReinforcements[originCityId].units[unitId] || 0) + movement.units[unitId];
        }

        transaction.update(targetCityRef, { reinforcements: newReinforcements });
        transaction.update(targetCitySlotRef, { reinforcements: newReinforcements });
        
        // # create reports for both players
        const reinforceReport = {
            type: 'reinforce',
            title: `Reinforcement to ${currentCityState.cityName}`,
            timestamp: serverTimestamp(),
            units: movement.units,
            read: false,
            originCityName: movement.originCityName,
            targetCityName: currentCityState.cityName,
            originPlayer: {
                username: movement.originOwnerUsername,
                id: movement.originOwnerId,
                cityId: movement.originCityId,
                x: movement.originCoords.x,
                y: movement.originCoords.y
            },
            targetPlayer: {
                username: movement.ownerUsername,
                id: movement.targetOwnerId,
                cityId: movement.targetCityId,
                x: movement.targetCoords.x,
                y: movement.targetCoords.y
            }
        };
        
        const originReportRef = doc(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`, `${movement.id}-ori`);
        transaction.set(originReportRef, reinforceReport);
        
        if (movement.targetOwnerId) {
            const arrivalReport = {
                ...reinforceReport,
                title: `Reinforcements from ${movement.originCityName}`,
            };
            const targetReportRef = doc(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`, `${movement.id}-tar`);
            transaction.set(targetReportRef, arrivalReport);
        }

        transaction.delete(movementDoc.ref);
    });
};
