import { doc, getDoc, getDocs, collection, writeBatch, serverTimestamp, deleteField, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getWarehouseCapacity } from '../../utils/helpers';

// # process a returning movement
export const processReturnMovement = async (movement, movementDoc, worldId, getHospitalCapacity) => {
    const batch = writeBatch(db);
    const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);
    const originCitySnap = await getDoc(originCityRef);

    if (!originCitySnap.exists()) {
        await deleteDoc(movementDoc.ref);
        return;
    }

    const originCityState = originCitySnap.data();

    // # credit units
    const newUnits = { ...(originCityState.units || {}) };
    for (const unitId in movement.units) {
        newUnits[unitId] = (newUnits[unitId] || 0) + movement.units[unitId];
    }
    
    // # credit agent
    if (movement.agent) {
        const newAgents = { ...(originCityState.agents || {}) };
        newAgents[movement.agent] = (newAgents[movement.agent] || 0) + 1;
        batch.update(originCityRef, { agents: newAgents });
    }

    // # handle hero return
    if (movement.hero) {
        const heroOwnerCitiesRef = collection(db, `users/${movement.originOwnerId}/games`, worldId, 'cities');
        const heroOwnerCitiesSnap = await getDocs(heroOwnerCitiesRef);
        heroOwnerCitiesSnap.forEach(cityDoc => {
            if (cityDoc.data().heroes?.[movement.hero]) {
                const updates = {
                    [`heroes.${movement.hero}.cityId`]: movement.originCityId,
                    [`heroes.${movement.hero}.capturedIn`]: deleteField()
                };
                batch.update(cityDoc.ref, updates);
            }
        });
    }

    // # credit resources
    const capacity = getWarehouseCapacity(originCityState.buildings.warehouse?.level);
    const newResources = { ...(originCityState.resources || {}) };
    if (movement.resources) {
        for (const resourceId in movement.resources) {
            newResources[resourceId] = (newResources[resourceId] || 0) + movement.resources[resourceId];
        }
    }
    newResources.wood = Math.min(capacity, newResources.wood || 0);
    newResources.stone = Math.min(capacity, newResources.stone || 0);
    newResources.silver = Math.min(capacity, newResources.silver || 0);

    // # handle wounded units
    const newWounded = { ...(originCityState.wounded || {}) };
    let totalWoundedInHospital = Object.values(newWounded).reduce((sum, count) => sum + count, 0);
    const hospitalCapacity = getHospitalCapacity(originCityState.buildings.hospital?.level || 0);
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
    
    // # create report
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
};
