import { doc, runTransaction, collection, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import buildingConfig from '../../gameData/buildings.json';

// # handle founding a new city, which is a two-step process
export const processFoundingMovement = async (movement, movementDoc, worldId, originCityRef) => {
    const targetSlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);

    if (movement.status === 'moving') {
        // # when the units arrive, the founding timer starts
        const newArrivalTime = new Date(Date.now() + movement.foundingTimeSeconds * 1000);
        await updateDoc(movementDoc.ref, {
            status: 'founding',
            arrivalTime: newArrivalTime,
        });
        return;
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
                
                // # if the plot was taken, send troops back
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
                        outcome: { message: `The plot at (${movement.targetCoords.x}, ${movement.targetCoords.y}) was claimed before your party arrived.` },
                        read: false,
                    };
                    transaction.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), failureReport);
                    return;
                }

                const originCityData = originCitySnap.data();
                
                // # update the city slot with new owner info
                transaction.update(targetSlotRef, {
                    ownerId: movement.originOwnerId,
                    ownerUsername: movement.originOwnerUsername,
                    cityName: movement.newCityName,
                    alliance: originCityData.alliance || null,
                    allianceName: originCityData.allianceName || null,
                });

                // # create the new city document
                const initialBuildings = {};
                Object.keys(buildingConfig).forEach(id => { initialBuildings[id] = { level: 0 }; });
                ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave'].forEach(id => {
                    initialBuildings[id].level = 1;
                });
                
                const newCityData = {
                    id: newCityDocRef.id,
                    slotId: movement.targetSlotId,
                    x: movement.targetCoords.x,
                    y: movement.targetCoords.y,
                    islandId: targetSlotSnap.data().islandId,
                    cityName: movement.newCityName,
                    playerInfo: originCityData.playerInfo,
                    resources: { wood: 1000, stone: 1000, silver: 500 },
                    buildings: initialBuildings,
                    units: movement.units, wounded: {}, research: {}, worship: {},
                    cave: { silver: 0 }, buildQueue: [], barracksQueue: [],
                    shipyardQueue: [], divineTempleQueue: [], healQueue: [],
                    lastUpdated: serverTimestamp(),
                };
                transaction.set(newCityDocRef, newCityData);

                // # send a success report
                const successReport = {
                    type: 'found_city_success',
                    title: `New city founded!`,
                    timestamp: serverTimestamp(),
                    outcome: { message: `You have founded the city of ${movement.newCityName} at (${movement.targetCoords.x}, ${movement.targetCoords.y}).` },
                    read: false,
                };
                transaction.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), successReport);
                
                transaction.delete(movementDoc.ref);
            });
        } catch (error) {
            console.error("Error in founding city transaction:", error);
            await deleteDoc(movementDoc.ref);
        }
    }
};
