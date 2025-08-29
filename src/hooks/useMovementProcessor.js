// src/hooks/useMovementProcessor.js
import { useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useCityState } from './useCityState';
// import all the new processor functions
import { processAttackMovement } from './movementProcessors/processAttackMovement';
import { processReturnMovement } from './movementProcessors/processReturnMovement';
import { processFoundingMovement } from './movementProcessors/processFoundingMovement';
import { processReinforceMovement } from './movementProcessors/processReinforceMovement';
import { processScoutMovement } from './movementProcessors/processScoutMovement';
import { processRescueMovement } from './movementProcessors/processRescueMovement';
import { processCollectWreckageMovement } from './movementProcessors/processCollectWreckageMovement';


export const useMovementProcessor = (worldId) => {
    const { getHospitalCapacity } = useCityState(worldId);

    const processMovement = useCallback(async (movementDoc) => {
        const movement = { id: movementDoc.id, ...movementDoc.data() };
        
        if (movement.type === 'assign_hero') {
            const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
            try {
                await runTransaction(db, async (transaction) => {
                    const cityDoc = await transaction.get(targetCityRef);
                    if (!cityDoc.exists()) throw new Error("Target city not found.");
    
                    const cityData = cityDoc.data();
                    const heroes = cityData.heroes || {};
                    
                    for (const hId in heroes) {
                        if (heroes[hId].cityId === movement.targetCityId) {
                            const failureReport = {
                                type: 'assign_hero_failed',
                                title: `Hero Assignment Failed`,
                                timestamp: serverTimestamp(),
                                outcome: { message: `Could not assign your hero to ${cityData.cityName} because it is already occupied by another hero.` },
                                read: false,
                            };
                            const reportRef = doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`));
                            transaction.set(reportRef, failureReport);
                            transaction.delete(movementDoc.ref);
                            return; // Exit transaction
                        }
                    }

                    const newHeroes = { ...heroes, [movement.hero]: { ...heroes[movement.hero], cityId: movement.targetCityId } };
    
                    transaction.update(targetCityRef, { heroes: newHeroes });
                    transaction.delete(movementDoc.ref);
                });
            } catch (error) {
                console.error("Error processing hero assignment:", error);
                await deleteDoc(movementDoc.ref);
            }
            return;
        }
        
        const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);
        let targetCityRef;
        if (movement.targetOwnerId && movement.targetCityId) {
            targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
        }

        const [originCitySnap, targetCitySnap] = await Promise.all([
            getDoc(originCityRef),
            targetCityRef ? getDoc(targetCityRef) : Promise.resolve(null)
        ]);

        if (!originCitySnap.exists()) {
            await deleteDoc(movementDoc.ref);
            return;
        }

        const originCityState = originCitySnap.data();
        const targetCityState = targetCitySnap?.exists() ? targetCitySnap.data() : null;

        if (movement.status === 'returning') {
            await processReturnMovement(movement, movementDoc, worldId, getHospitalCapacity);
        
        } else if (movement.status === 'moving' || movement.status === 'founding') {
            switch (movement.type) {
                case 'found_city':
                    await processFoundingMovement(movement, movementDoc, worldId, originCityRef);
                    break;
                case 'attack':
                case 'attack_village':
                case 'attack_ruin':
                case 'attack_god_town':
                    await processAttackMovement(movement, movementDoc, worldId, originCityState, targetCityState, null, null);
                    break;
                case 'reinforce':
                    await processReinforceMovement(movement, movementDoc, worldId, targetCityRef);
                    break;
                case 'scout':
                    await processScoutMovement(movement, movementDoc, worldId, originCityState, targetCityState, null, null);
                    break;
                case 'rescue_hero':
                    await processRescueMovement(movement, movementDoc, worldId, originCityState, targetCityState);
                    break;
                case 'collect_wreckage':
                    await processCollectWreckageMovement(movement, movementDoc, worldId);
                    break;
                default:
                    console.log(`Unknown movement type: ${movement.type}. Deleting movement ${movement.id}`);
                    await deleteDoc(movementDoc.ref);
                    break;
            }
        }
    }, [worldId, getHospitalCapacity]);

    useEffect(() => {
        const processMovements = async () => {
            if (!worldId) return;
            const movementsRef = collection(db, 'worlds', worldId, 'movements');
            const q = query(movementsRef, where('arrivalTime', '<=', new Date()));
            const arrivedMovementsSnapshot = await getDocs(q);

            if (arrivedMovementsSnapshot.empty) return;

            console.log(`Found ${arrivedMovementsSnapshot.docs.length} arrived movements to process.`);
            for (const movementDoc of arrivedMovementsSnapshot.docs) {
                try {
                    await processMovement(movementDoc);
                } catch (error) {
                    console.error("Error processing movement:", movementDoc.id, error);
                }
            }
        };

        const interval = setInterval(processMovements, 5000); // # check every 5 seconds
        return () => clearInterval(interval);
    }, [worldId, processMovement]);
};
