// src/hooks/movementProcessors/processRescueMovement.js
import { doc,  writeBatch, collection, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { calculateDistance, calculateTravelTime } from '../../utils/travel';

// # handles the logic for a hero rescue mission
export const processRescueMovement = async (movement, movementDoc, worldId, originCityState, targetCityState) => {
    const batch = writeBatch(db);
    const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
    const targetCitySlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);

    const defenderCaveSilver = targetCityState.cave?.silver || 0;
    const success = movement.silver > defenderCaveSilver;

    if (success) {
        // # SUCCESSFUL RESCUE
        const newPrisoners = targetCityState.prisoners.filter(p => p.heroId !== movement.heroToRescueId);
        batch.update(targetCityRef, { prisoners: newPrisoners });
        batch.update(targetCitySlotRef, { capturedHero: deleteField() });

        // # Create a return movement for the freed hero
        const returnMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
        const distance = calculateDistance(targetCityState, originCityState);
        const travelSeconds = calculateTravelTime(distance, 10); // Hero travels at a base speed
        const arrivalTime = new Date(Date.now() + travelSeconds * 1000);
        
        const returnMovement = {
            type: 'return',
            status: 'returning',
            hero: movement.heroToRescueId,
            originCityId: movement.targetCityId,
            originCoords: { x: targetCityState.x, y: targetCityState.y },
            targetCityId: movement.originCityId,
            targetCoords: { x: originCityState.x, y: originCityState.y },
            targetOwnerId: movement.originOwnerId,
            departureTime: serverTimestamp(),
            arrivalTime: arrivalTime,
            involvedParties: [movement.originOwnerId, movement.targetOwnerId]
        };
        batch.set(returnMovementRef, returnMovement);
        
        // # Update hero's status to remove 'capturedIn'
        const heroOwnerCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);
        batch.update(heroOwnerCityRef, { [`heroes.${movement.heroToRescueId}.capturedIn`]: deleteField() });


        // # Reports
        const attackerReport = {
            type: 'rescue_success',
            title: `Rescue Successful!`,
            timestamp: serverTimestamp(),
            outcome: { message: `Your Liberator successfully rescued your hero from ${targetCityState.cityName}!` },
            read: false,
        };
        const attackerReportRef = doc(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`, `${movement.id}-atk-succ`);
        batch.set(attackerReportRef, attackerReport);

        const defenderReport = {
            type: 'rescue_foiled',
            title: `Prison Break!`,
            timestamp: serverTimestamp(),
            outcome: { message: `A Liberator from ${originCityState.cityName} infiltrated your prison and freed a captured hero!` },
            read: false,
        };
        const defenderReportRef = doc(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`, `${movement.id}-def-foil`);
        batch.set(defenderReportRef, defenderReport);

    } else {
        // # FAILED RESCUE
        // # Reports
        const attackerReport = {
            type: 'rescue_failure',
            title: `Rescue Failed!`,
            timestamp: serverTimestamp(),
            outcome: { message: `Your Liberator was caught and eliminated while trying to rescue your hero from ${targetCityState.cityName}.` },
            read: false,
        };
        const attackerReportRef = doc(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`, `${movement.id}-atk-fail`);
        batch.set(attackerReportRef, attackerReport);

        const defenderReport = {
            type: 'rescue_thwarted',
            title: `Spy Caught!`,
            timestamp: serverTimestamp(),
            outcome: { message: `Your guards caught a Liberator from ${originCityState.cityName} attempting a prison break!` },
            read: false,
        };
        const defenderReportRef = doc(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`, `${movement.id}-def-thwart`);
        batch.set(defenderReportRef, defenderReport);
    }

    // # Delete the rescue movement itself
    batch.delete(movementDoc.ref);
    await batch.commit();
};
