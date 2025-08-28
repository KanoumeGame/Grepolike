import { doc, getDoc, writeBatch, runTransaction, collection, serverTimestamp, deleteField} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { resolveCombat, getVillageTroops } from '../../utils/combat';
import unitConfig from '../../gameData/units.json';
import { v4 as uuidv4 } from 'uuid';

// # processes all attack-related movements
export const processAttackMovement = async (
    movement,
    movementDoc,
    worldId,
    originCityState,
    targetCityState, // # This will be null for villages/ruins
    originAllianceData,
    targetAllianceData
) => {
    console.log(`[AttackProcessor] Processing attack: ${movement.id}, type: ${movement.type}`);
    const batch = writeBatch(db);

    // # --- Ruin Attack Logic ---
    if (movement.type === 'attack_ruin') {
        console.log("[AttackProcessor] Handling ruin attack...");
        const ruinRef = doc(db, 'worlds', worldId, 'ruins', movement.targetRuinId);
        const ruinSnap = await getDoc(ruinRef);

        if (!ruinSnap.exists()) {
            console.log("[AttackProcessor] Ruin not found, returning troops.");
            const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
            const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
            batch.update(movementDoc.ref, { status: 'returning', arrivalTime: returnArrivalTime });
            await batch.commit();
            return;
        }

        const ruinData = ruinSnap.data();
        const result = resolveCombat(movement.units, ruinData.troops, {}, true); // # Ruins are cross-island
        console.log("[AttackProcessor] Ruin combat resolved:", result);

        const attackerReport = {
            type: 'attack_ruin',
            title: `Attack on ${ruinData.name}`,
            timestamp: serverTimestamp(),
            outcome: result,
            attacker: {
                cityId: movement.originCityId,
                cityName: originCityState.cityName,
                units: movement.units,
                losses: result.attackerLosses,
                ownerId: movement.originOwnerId,
                username: movement.originOwnerUsername,
                x: originCityState.x,
                y: originCityState.y
            },
            defender: {
                ruinName: ruinData.name,
                troops: ruinData.troops,
                losses: result.defenderLosses,
                x: ruinData.x,
                y: ruinData.y
            },
            read: false,
        };

        if (result.attackerWon) {
            console.log("[AttackProcessor] Attacker won against ruin. Assigning reward and ownership.");
            batch.update(ruinRef, { ownerId: movement.originOwnerId, ownerUsername: movement.originOwnerUsername });
            const playerRuinRef = doc(db, `users/${movement.originOwnerId}/games/${worldId}/conqueredRuins`, movement.targetRuinId);
            batch.set(playerRuinRef, { research: ruinData.researchReward, conqueredAt: serverTimestamp() });
            attackerReport.reward = ruinData.researchReward;
        }
        
        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
        
        const survivingAttackers = {};
        for (const unitId in movement.units) {
            const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0);
            if (survivors > 0) survivingAttackers[unitId] = survivors;
        }

        if (Object.keys(survivingAttackers).length > 0) {
            const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
            const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
            batch.update(movementDoc.ref, {
                status: 'returning',
                units: survivingAttackers,
                arrivalTime: returnArrivalTime,
            });
            console.log("[AttackProcessor] Surviving troops returning from ruin.");
        } else {
            console.log("[AttackProcessor] No surviving troops, deleting movement.");
            batch.delete(movementDoc.ref);
        }

        await batch.commit();
        return;
    }

    // # --- Village Attack Logic ---
    if (movement.type === 'attack_village') {
        const villageRef = doc(db, 'worlds', worldId, 'villages', movement.targetVillageId);
        const villageSnap = await getDoc(villageRef);
        if (!villageSnap.exists()) {
            const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
            const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
            batch.update(movementDoc.ref, { status: 'returning', arrivalTime: returnArrivalTime });
            await batch.commit();
            return;
        }

        const villageData = villageSnap.data();
        const villageTroops = getVillageTroops(villageData);
        const result = resolveCombat(movement.units, villageTroops, villageData.resources, false);

        if (result.attackerWon) {
            const playerVillageRef = doc(db, `users/${movement.originOwnerId}/games/${worldId}/conqueredVillages`, movement.targetVillageId);
            batch.set(playerVillageRef, {
                level: villageData.level,
                lastCollected: serverTimestamp(),
                happiness: 100,
                happinessLastUpdated: serverTimestamp()
            }, { merge: true });
            const questEventRef = doc(collection(db, `users/${movement.originOwnerId}/games/${worldId}/questEvents`));
            batch.set(questEventRef, { type: 'attack_village', timestamp: serverTimestamp() });
        }

        const reportOutcome = { ...result };
        delete reportOutcome.attackerBattlePoints;
        delete reportOutcome.defenderBattlePoints;

        const attackerReport = {
            type: 'attack_village',
            title: `Attack on ${villageData.name}`,
            timestamp: serverTimestamp(),
            outcome: reportOutcome,
            attacker: {
                cityId: movement.originCityId,
                cityName: originCityState.cityName,
                units: movement.units,
                losses: result.attackerLosses,
                ownerId: movement.originOwnerId,
                username: movement.originOwnerUsername || 'Unknown Player',
                allianceId: originAllianceData ? originAllianceData.id : null,
                allianceName: originAllianceData ? originAllianceData.name : null,
                x: originCityState.x,
                y: originCityState.y
            },
            defender: {
                villageId: movement.targetVillageId,
                villageName: villageData.name,
                troops: villageTroops,
                losses: result.defenderLosses,
                x: villageData.x,
                y: villageData.y
            },
            read: false,
        };
        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);

        const survivingAttackers = {};
        let anySurvivors = false;
        for (const unitId in movement.units) {
            const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
            if (survivors > 0) {
                survivingAttackers[unitId] = survivors;
                anySurvivors = true;
            }
        }

        if (anySurvivors || Object.keys(result.wounded).length > 0) {
            const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
            const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
            batch.update(movementDoc.ref, {
                status: 'returning',
                units: survivingAttackers,
                resources: result.plunder,
                wounded: result.wounded,
                arrivalTime: returnArrivalTime,
                involvedParties: [movement.originOwnerId]
            });
        } else {
            batch.delete(movementDoc.ref);
        }
        await batch.commit();
        return;
    }

    // # --- City Attack Logic ---
    if (!targetCityState) {
        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
        batch.update(movementDoc.ref, {
            status: 'returning',
            arrivalTime: returnArrivalTime,
            involvedParties: [movement.originOwnerId]
        });
        await batch.commit();
        return;
    }

    const allDefendingUnits = { ...(targetCityState.units || {}) };
    if (targetCityState.reinforcements) {
        for (const originCityId in targetCityState.reinforcements) {
            const reinf = targetCityState.reinforcements[originCityId];
            for (const unitId in reinf.units) {
                allDefendingUnits[unitId] = (allDefendingUnits[unitId] || 0) + reinf.units[unitId];
            }
        }
    }

    const result = resolveCombat(
        movement.units,
        allDefendingUnits,
        targetCityState.resources,
        !!movement.isCrossIsland,
        movement.attackFormation?.front,
        movement.attackFormation?.mid,
        null,
        null,
        movement.hero,
        Object.keys(targetCityState.heroes || {}).find(id => targetCityState.heroes[id].cityId === movement.targetCityId) || null,
        targetCityState
    );
    
    await runTransaction(db, async (transaction) => {
        const attackerGameRef = doc(db, `users/${movement.originOwnerId}/games`, worldId);
        const defenderGameRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId);
        const attackerGameDoc = await transaction.get(attackerGameRef);
        const defenderGameDoc = await transaction.get(defenderGameRef);

        if (attackerGameDoc.exists() && result.attackerBattlePoints > 0) {
            const currentPoints = attackerGameDoc.data().battlePoints || 0;
            transaction.update(attackerGameRef, { battlePoints: currentPoints + result.attackerBattlePoints });
        }
        if (defenderGameDoc.exists() && result.defenderBattlePoints > 0) {
            const currentPoints = defenderGameDoc.data().battlePoints || 0;
            transaction.update(defenderGameRef, { battlePoints: currentPoints + result.defenderBattlePoints });
        }
    });

    const newDefenderUnits = { ...(targetCityState.units || {}) };
    const newReinforcements = JSON.parse(JSON.stringify(targetCityState.reinforcements || {}));
    const reinforcementLossesReport = {};

    for (const unitId in result.defenderLosses) {
        const totalLosses = result.defenderLosses[unitId];
        const totalPresent = allDefendingUnits[unitId];
        if (totalPresent <= 0) continue;

        const ownerCount = newDefenderUnits[unitId] || 0;
        if (ownerCount > 0) {
            const ownerLosses = Math.round((ownerCount / totalPresent) * totalLosses);
            newDefenderUnits[unitId] = Math.max(0, ownerCount - ownerLosses);
        }

        for (const originCityId in newReinforcements) {
            const reinf = newReinforcements[originCityId];
            const reinfCount = reinf.units?.[unitId] || 0;
            if (reinfCount > 0) {
                const reinfLosses = Math.round((reinfCount / totalPresent) * totalLosses);
                const actualLosses = Math.min(reinfCount, reinfLosses);
                reinf.units[unitId] -= actualLosses;
                
                if (actualLosses > 0) {
                    if (!reinforcementLossesReport[reinf.ownerId]) {
                        reinforcementLossesReport[reinf.ownerId] = { losses: {} };
                    }
                    reinforcementLossesReport[reinf.ownerId].losses[unitId] = (reinforcementLossesReport[reinf.ownerId].losses[unitId] || 0) + actualLosses;
                }
            }
        }
    }

    Object.keys(newDefenderUnits).forEach(id => { if (newDefenderUnits[id] <= 0) delete newDefenderUnits[id]; });
    for (const originCityId in newReinforcements) {
        Object.keys(newReinforcements[originCityId].units).forEach(id => {
            if (newReinforcements[originCityId].units[id] <= 0) delete newReinforcements[originCityId].units[id];
        });
        if (Object.keys(newReinforcements[originCityId].units).length === 0) delete newReinforcements[originCityId];
    }
    
    const newDefenderResources = { ...targetCityState.resources };
    if (result.attackerWon) {
        newDefenderResources.wood = Math.max(0, newDefenderResources.wood - result.plunder.wood);
        newDefenderResources.stone = Math.max(0, newDefenderResources.stone - result.plunder.stone);
        newDefenderResources.silver = Math.max(0, newDefenderResources.silver - result.plunder.silver);
    }
    
    const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
    
    // # Hero state updates
    const newDefenderHeroes = { ...(targetCityState.heroes || {}) };
    const newAttackerHeroes = { ...(originCityState.heroes || {}) };
    const newPrisoners = targetCityState.prisoners || [];
    let capturedHeroForSlot = null;

    if (result.capturedHero) {
        const { heroId, capturedBy } = result.capturedHero;
        if (capturedBy === 'defender') { // Attacker's hero was captured
            newAttackerHeroes[heroId].capturedIn = movement.targetCityId;
            newPrisoners.push({
                heroId: heroId,
                ownerId: movement.originOwnerId,
                ownerUsername: movement.originOwnerUsername,
                capturedAt: new Date(),
                originCityId: movement.originCityId,
                originCityName: originCityState.cityName,
                originCityCoords: { x: originCityState.x, y: originCityState.y },
                captureId: uuidv4()
            });
            capturedHeroForSlot = [heroId, movement.originOwnerId];
        }
    } else {
        // # If no hero was captured, ensure the field is cleared
        capturedHeroForSlot = deleteField();
    }

    if (result.woundedHero) {
        const { heroId, side } = result.woundedHero;
        const woundDuration = 3600 * 1000 * 6; // 6 hours
        const woundedUntil = new Date(Date.now() + woundDuration);
        if (side === 'attacker') {
            newAttackerHeroes[heroId].woundedUntil = woundedUntil;
        } else {
            newDefenderHeroes[heroId].woundedUntil = woundedUntil;
        }
    }

    batch.update(targetCityRef, { units: newDefenderUnits, resources: newDefenderResources, reinforcements: newReinforcements, heroes: newDefenderHeroes, prisoners: newPrisoners });
    
    const attackerCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);
    batch.update(attackerCityRef, { heroes: newAttackerHeroes });


    const targetCitySlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);
    batch.update(targetCitySlotRef, { reinforcements: newReinforcements, capturedHero: capturedHeroForSlot });

    const hasSurvivingLandOrMythic = Object.keys(movement.units).some(unitId => {
        const unit = unitConfig[unitId];
        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0);
        return unit && (unit.type === 'land' || unit.mythical) && survivors > 0;
    });
    
    const attackerReport = {
        type: 'attack',
        title: `Attack on ${targetCityState.cityName}`,
        timestamp: serverTimestamp(),
        outcome: result,
        attacker: { 
            cityId: movement.originCityId,
            cityName: originCityState.cityName,
            units: movement.units,
            hero: movement.hero || null,
            losses: result.attackerLosses,
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
            units: hasSurvivingLandOrMythic ? targetCityState.units : {},
            hero: hasSurvivingLandOrMythic ? (Object.keys(targetCityState.heroes || {}).find(id => targetCityState.heroes[id].cityId === movement.targetCityId) || null) : null,
            losses: hasSurvivingLandOrMythic ? result.defenderLosses : {},
            ownerId: movement.targetOwnerId,
            username: movement.ownerUsername,
            allianceId: targetAllianceData?.id || null,
            allianceName: targetAllianceData?.name || null,
            x: targetCityState.x,
            y: targetCityState.y
        },
        read: false,
    };

    if (!hasSurvivingLandOrMythic) {
        attackerReport.outcome.message = "Your forces were annihilated. No information could be gathered from the battle.";
    }

    const defenderReport = {
        type: 'attack',
        title: `Defense of ${targetCityState.cityName}`,
        timestamp: serverTimestamp(),
        outcome: {
            attackerWon: !result.attackerWon,
            plunder: {},
            attackerLosses: result.attackerLosses,
            defenderLosses: result.defenderLosses,
            wounded: {},
            attackerBattlePoints: result.attackerBattlePoints,
            defenderBattlePoints: result.defenderBattlePoints,
            capturedHero: result.capturedHero,
            woundedHero: result.woundedHero,
        },
        attacker: attackerReport.attacker,
        defender: {
            ...attackerReport.defender,
            units: targetCityState.units,
            hero: Object.keys(targetCityState.heroes || {}).find(id => targetCityState.heroes[id].cityId === movement.targetCityId) || null,
            losses: result.defenderLosses,
        },
        read: false,
    };
    
    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
    if (movement.targetOwnerId) {
        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), defenderReport);
    }
    
    const survivingAttackers = {};
    for (const unitId in movement.units) {
        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
        if (survivors > 0) {
            survivingAttackers[unitId] = survivors;
        }
    }
    
    const heroSurvives = movement.hero && (!result.capturedHero || result.capturedHero.heroId !== movement.hero) && (!result.woundedHero || result.woundedHero.heroId !== movement.hero || result.woundedHero.side !== 'attacker');
    if (Object.keys(survivingAttackers).length > 0 || Object.keys(result.wounded).length > 0 || heroSurvives) {
        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
        const returningMovementData = {
            status: 'returning',
            units: survivingAttackers,
            resources: result.plunder,
            wounded: result.wounded,
            arrivalTime: returnArrivalTime,
            involvedParties: [movement.originOwnerId]
        };
        if (heroSurvives) {
            returningMovementData.hero = movement.hero;
        }
        batch.update(movementDoc.ref, returningMovementData);
    } else {
        batch.delete(movementDoc.ref);
    }

    await batch.commit();
};