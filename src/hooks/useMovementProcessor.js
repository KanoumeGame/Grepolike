import { useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, runTransaction,deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import { useCityState } from './useCityState';
import buildingConfig from '../gameData/buildings.json';
import heroesConfig from '../gameData/heroes.json';
import { calculateDistance, calculateTravelTime } from '../utils/travel';

const getWarehouseCapacity = (level) => {
    if (!level) return 0;
    return Math.floor(1500 * Math.pow(1.4, level - 1));
};

export const useMovementProcessor = (worldId) => {
    const { getHospitalCapacity } = useCityState(worldId);

    const processMovement = useCallback(async (movementDoc) => {
        const movement = { id: movementDoc.id, ...movementDoc.data() };

        //  Handle hero assignment first as it has no origin city
        if (movement.type === 'assign_hero') {
            const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
            try {
                await runTransaction(db, async (transaction) => {
                    const cityDoc = await transaction.get(targetCityRef);
                    if (!cityDoc.exists()) throw new Error("Target city not found.");
    
                    const cityData = cityDoc.data();
                    const heroes = cityData.heroes || {};
                    const newHeroes = { ...heroes, [movement.hero]: { ...heroes[movement.hero], cityId: movement.targetCityId } };
    
                    transaction.update(targetCityRef, { heroes: newHeroes });
                    transaction.delete(movementDoc.ref);
                });
            } catch (error) {
                console.error("Error processing hero assignment:", error);
                await deleteDoc(movementDoc.ref);
            }
            return; // End processing for this movement
        }
        
        const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);

        let targetCityRef;
        if (movement.targetOwnerId && movement.targetCityId) {
            targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
        }

        // Handle free_hero movement
        if (movement.type === 'free_hero') {
            try {
                const heroOwnerCitiesRef = collection(db, `users/${movement.heroOwnerId}/games`, worldId, 'cities');
                const heroOwnerCitiesSnap = await getDocs(heroOwnerCitiesRef);

                await runTransaction(db, async (transaction) => {
                    const targetCitySnap = await transaction.get(targetCityRef);
                    if (!targetCitySnap.exists()) throw new Error("Target city not found.");

                    const targetCityData = targetCitySnap.data();
                    const enemyCaveSilver = targetCityData.cave?.silver || 0;

                    const attackerReportRef = doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`));
                    const defenderReportRef = doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`));

                    if (movement.silverAmount > enemyCaveSilver) {
                        // SUCCESS
                        const newPrisoners = (targetCityData.prisoners || []).filter(p => p.heroId !== movement.heroToFreeId);
                        transaction.update(targetCityRef, { prisoners: newPrisoners });

                        heroOwnerCitiesSnap.forEach(cityDoc => {
                            if (cityDoc.data().heroes?.[movement.heroToFreeId]) {
                                transaction.update(cityDoc.ref, { [`heroes.${movement.heroToFreeId}.capturedIn`]: deleteField() });
                            }
                        });

                        const prisonerData = (targetCityData.prisoners || []).find(p => p.heroId === movement.heroToFreeId);
                        const homeCityCoords = prisonerData?.originCityCoords || { x: 0, y: 0 };
                        const distance = calculateDistance(targetCityData, homeCityCoords);
                        const travelSeconds = calculateTravelTime(distance, 10);
                        const arrivalTime = new Date(Date.now() + travelSeconds * 1000);

                        const returnMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
                        transaction.set(returnMovementRef, {
                            type: 'return', status: 'returning', hero: movement.heroToFreeId,
                            originCityId: movement.targetCityId, originCoords: { x: targetCityData.x, y: targetCityData.y },
                            targetCityId: prisonerData?.originCityId, targetCoords: homeCityCoords,
                            targetOwnerId: movement.heroOwnerId, departureTime: serverTimestamp(), arrivalTime,
                            involvedParties: [movement.heroOwnerId]
                        });

                        transaction.set(attackerReportRef, {
                            type: 'free_hero', title: `Rescue Successful!`, timestamp: serverTimestamp(), read: false,
                            outcome: { message: `${heroesConfig[movement.heroToFreeId].name} was freed from ${movement.targetCityName}!` }
                        });
                        transaction.set(defenderReportRef, {
                            type: 'free_hero', title: `Prisoner Freed!`, timestamp: serverTimestamp(), read: false,
                            outcome: { message: `A Liberator agent from ${movement.originCityName} freed your prisoner, ${heroesConfig[movement.heroToFreeId].name}!` }
                        });

                    } else {
                        // FAILURE
                        const newCaveSilver = enemyCaveSilver + movement.silverAmount;
                        transaction.update(targetCityRef, { 'cave.silver': newCaveSilver });

                        transaction.set(attackerReportRef, {
                            type: 'free_hero', title: `Rescue Failed!`, timestamp: serverTimestamp(), read: false,
                            outcome: { message: `Your Liberator was caught and executed while trying to free ${heroesConfig[movement.heroToFreeId].name} from ${movement.targetCityName}. Your silver was confiscated.` }
                        });
                        transaction.set(defenderReportRef, {
                            type: 'free_hero', title: `Rescue Attempt Foiled!`, timestamp: serverTimestamp(), read: false,
                            outcome: { message: `An enemy Liberator was caught trying to free ${heroesConfig[movement.heroToFreeId].name}. You have confiscated ${movement.silverAmount} silver.` }
                        });
                    }
                    transaction.delete(movementDoc.ref);
                });
            } catch (error) {
                console.error("Error processing free_hero movement:", error);
                await deleteDoc(movementDoc.ref);
            }
            return;
        }


        //  Handle city founding movements
        if (movement.type === 'found_city') {
            const targetSlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);

            if (movement.status === 'moving') {
                // Troops have arrived, now start the founding timer.
                const newArrivalTime = new Date(Date.now() + movement.foundingTimeSeconds * 1000);
                await updateDoc(movementDoc.ref, {
                    status: 'founding',
                    arrivalTime: newArrivalTime,
                });
                return; // Stop processing, wait for founding to finish
            }

            if (movement.status === 'founding') {
                const newCityDocRef = doc(collection(db, `users/${movement.originOwnerId}/games`, worldId, 'cities'));
                try {
                    await runTransaction(db, async (transaction) => {
                        const [targetSlotSnap, originCitySnap] = await Promise.all([
                            transaction.get(targetSlotRef),
                            transaction.get(originCityRef)
                        ]);
                        if (!originCitySnap.exists()) {
                            transaction.delete(movementDoc.ref);
                            return;
                        }
                        if (!targetSlotSnap.exists() || targetSlotSnap.data().ownerId !== null) {
                            const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                            const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                            transaction.update(movementDoc.ref, {
                                status: 'returning',
                                units: movement.units,
                                agent: movement.agent,
                                arrivalTime: returnArrivalTime,
                                involvedParties: [movement.originOwnerId]
                            });
                            const failureReport = {
                                type: 'found_city_failed',
                                title: `Founding attempt failed`,
                                timestamp: serverTimestamp(),
                                outcome: { message: `The plot at (${movement.targetCoords.x}, ${movement.targetCoords.y}) was claimed by another player before your party arrived.` },
                                read: false,
                            };
                            transaction.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), failureReport);
                            return;
                        }
                        const originCityData = originCitySnap.data();
                        const newCityName = movement.newCityName;
                        transaction.update(targetSlotRef, {
                            ownerId: movement.originOwnerId,
                            ownerUsername: movement.originOwnerUsername,
                            cityName: newCityName,
                            alliance: originCityData.alliance || null,
                            allianceName: originCityData.allianceName || null,
                        });
                        const initialBuildings = {};
                        Object.keys(buildingConfig).forEach(id => {
                            initialBuildings[id] = { level: 0 };
                        });
                        ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave'].forEach(id => {
                            initialBuildings[id] = { level: 1 };
                        });
                        const newCityData = {
                            id: newCityDocRef.id,
                            slotId: movement.targetSlotId,
                            x: movement.targetCoords.x,
                            y: movement.targetCoords.y,
                            islandId: targetSlotSnap.data().islandId,
                            cityName: newCityName,
                            playerInfo: originCityData.playerInfo,
                            resources: { wood: 1000, stone: 1000, silver: 500 },
                            buildings: initialBuildings,
                            units: movement.units, wounded: {}, research: {}, worship: {},
                            cave: { silver: 0 }, buildQueue: [], barracksQueue: [],
                            shipyardQueue: [], divineTempleQueue: [], healQueue: [],
                            lastUpdated: serverTimestamp(),
                        };
                        transaction.set(newCityDocRef, newCityData);
                        const successReport = {
                            type: 'found_city_success',
                            title: `New city founded!`,
                            timestamp: serverTimestamp(),
                            outcome: { message: `You have successfully founded the city of ${newCityName} at (${movement.targetCoords.x}, ${movement.targetCoords.y}). Your troops have garrisoned the new city.` },
                            read: false,
                        };
                        transaction.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), successReport);
                        transaction.delete(movementDoc.ref);
                    });
                } catch (error) {
                    console.error("Error in found_city transaction:", error);
                    await deleteDoc(movementDoc.ref);
                }
                return;
            }
        }


        const batch = writeBatch(db);
        const [originCitySnap] = await Promise.all([
            getDoc(originCityRef),
            targetCityRef ? getDoc(targetCityRef) : Promise.resolve(null)
        ]);

        if (!originCitySnap.exists()) {
            batch.delete(movementDoc.ref);
            await batch.commit();
            return;
        }

        const originCityState = originCitySnap.data();

        if (movement.status === 'returning') {
            const newCityState = { ...originCityState };
            const newUnits = { ...newCityState.units };
            for (const unitId in movement.units) {
                newUnits[unitId] = (newUnits[unitId] || 0) + movement.units[unitId];
            }
            //  Return agent if it exists in the movement
            if (movement.agent) {
                const newAgents = { ...(newCityState.agents || {}) };
                newAgents[movement.agent] = (newAgents[movement.agent] || 0) + 1;
                batch.update(originCityRef, { agents: newAgents });
            }

            //  When a hero returns, update their status across ALL of the owner's cities.
            if (movement.hero) {
                const heroOwnerCitiesRef = collection(db, `users/${movement.originOwnerId}/games`, worldId, 'cities');
                const heroOwnerCitiesSnap = await getDocs(heroOwnerCitiesRef);

                //  Atomically update only the necessary fields for the hero in all of the owner's cities.
                //  This prevents race conditions where a stale 'woundedUntil' field might be overwritten.
                heroOwnerCitiesSnap.forEach(cityDoc => {
                    const cityData = cityDoc.data();
                    //  Check if the city has data for this hero before attempting an update.
                    if (cityData.heroes && cityData.heroes[movement.hero]) {
                        const updates = {};
                        updates[`heroes.${movement.hero}.cityId`] = movement.originCityId;
                        updates[`heroes.${movement.hero}.capturedIn`] = deleteField();
                        
                        //  Using updateDoc within the batch for targeted field updates.
                        batch.update(cityDoc.ref, updates);
                    }
                });
            }

            const capacity = getWarehouseCapacity(newCityState.buildings.warehouse?.level);
            const newResources = { ...newCityState.resources };

            if (movement.resources) {
                for (const resourceId in movement.resources) {
                    newResources[resourceId] = (newResources[resourceId] || 0) + movement.resources[resourceId];
                }
            }
            newResources.wood = Math.min(capacity, newResources.wood || 0);
            newResources.stone = Math.min(capacity, newResources.stone || 0);
            newResources.silver = Math.min(capacity, newResources.silver || 0);

            const newWounded = { ...newCityState.wounded };
            let totalWoundedInHospital = Object.values(newWounded).reduce((sum, count) => sum + count, 0);
            const hospitalCapacity = getHospitalCapacity(newCityState.buildings.hospital?.level || 0);

            if (movement.wounded) {
                for (const unitId in movement.wounded) {
                    const woundedCount = movement.wounded[unitId];
                    if (totalWoundedInHospital < hospitalCapacity) {
                        const canFit = hospitalCapacity - totalWoundedInHospital;
                        const toHeal = Math.min(canFit, woundedCount);
                        newWounded[unitId] = (newWounded[unitId] || 0) + toHeal;
                        totalWoundedInHospital += toHeal;
                    }
                }
            }

             const returnReport = {
                type: 'return',
                title: `Troops returned to ${originCityState.cityName}`,
                timestamp: serverTimestamp(),
                units: movement.units || {},
                hero: movement.hero || null,
                resources: movement.resources || {},
                wounded: movement.wounded || {},
                read: false,
            };

            batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), returnReport);
            batch.update(originCityRef, { units: newUnits, resources: newResources, wounded: newWounded });
            batch.delete(movementDoc.ref);
            await batch.commit();
        } else if (movement.status === 'moving') {
            // ... (rest of the combat/scout/reinforce logic)
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
        const interval = setInterval(processMovements, 5000);
        return () => clearInterval(interval);
    }, [worldId, processMovement]);
};
