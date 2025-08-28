import { doc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { resolveScouting } from '../../utils/combat';

// # handles what happens when a scout arrives
export const processScoutMovement = async (movement, movementDoc, worldId, originCityState, targetCityState, originAllianceData, targetAllianceData) => {
    const batch = writeBatch(db);

    if (!targetCityState) {
        batch.delete(movementDoc.ref);
        await batch.commit();
        return;
    }

    const result = resolveScouting(targetCityState, movement.resources?.silver || 0);
    
    if (result.success) {
        const scoutReport = {
            type: 'scout',
            title: `Scout report of ${targetCityState.cityName}`,
            timestamp: serverTimestamp(),
            scoutSucceeded: true,
            ...result,
            targetOwnerUsername: movement.ownerUsername,
            attacker: {
                cityId: movement.originCityId,
                cityName: originCityState.cityName,
                ownerId: movement.originOwnerId,
                username: movement.originOwnerUsername,
                allianceId: originAllianceData?.id || null,
                allianceName: originAllianceData?.name || null,
                x: originCityState.x,
                y: originCityState.y
            },
            defender: {
                cityId: movement.targetCityId,
                cityName: targetCityState.cityName,
                ownerId: movement.targetOwnerId,
                username: movement.ownerUsername,
                allianceId: targetAllianceData?.id || null,
                allianceName: targetAllianceData?.name || null,
                x: targetCityState.x,
                y: targetCityState.y
            },
            read: false,
        };
        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), scoutReport);
    } else {
        const failedScoutAttackerReport = {
            type: 'scout',
            title: `Scouting ${targetCityState.cityName} failed`,
            timestamp: serverTimestamp(),
            scoutSucceeded: false,
            message: result.message,
            read: false,
        };
        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), failedScoutAttackerReport);
        
        if (result.silverLostByDefender > 0) {
            const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
            const newDefenderCave = { ...targetCityState.cave, silver: (targetCityState.cave?.silver || 0) - result.silverLostByDefender };
            batch.update(targetCityRef, { cave: newDefenderCave });
        }

        const spyCaughtReport = {
            type: 'spy_caught',
            title: `Caught a spy from ${originCityState.cityName}!`,
            timestamp: serverTimestamp(),
            originCityName: originCityState.cityName,
            silverGained: 0,
            read: false,
        };
        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), spyCaughtReport);
    }

    batch.delete(movementDoc.ref);
    await batch.commit();
};
