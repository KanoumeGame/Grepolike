import { doc, getDoc, writeBatch, collection, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import buildingConfig from '../../gameData/buildings.json';

export const useDivineActions = ({
    cityGameState, setCityGameState, saveGameState, worldId, currentUser, userProfile, playerCity,
    closeModal, setMessage
}) => {
    // # worship a god
    const handleWorshipGod = async (godName) => {
        if (!cityGameState || !godName) return;
        const newWorshipData = { ...(cityGameState.worship || {}) };
        if (newWorshipData[godName] === undefined) {
            newWorshipData[godName] = 0;
        }
        newWorshipData.lastFavorUpdate = Date.now();
        const newGameState = { ...cityGameState, god: godName, worship: newWorshipData };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
        closeModal('isTempleMenuOpen');
    };

    // # cast a spell
    const handleCastSpell = async (power, targetCity) => {
        console.log("[DivineActions Debug] handleCastSpell initiated.");
        console.log("[DivineActions Debug] Received targetCity object:", JSON.parse(JSON.stringify(targetCity || {})));

        const currentState = cityGameState;
        if (!currentState?.god || (currentState.worship[currentState.god] || 0) < power.favorCost) {
            setMessage("Not enough favor to cast this spell.");
            return;
        }

        const batch = writeBatch(db);
        const casterGameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', cityGameState.id);
        
        const newWorship = { ...currentState.worship, [currentState.god]: currentState.worship[currentState.god] - power.favorCost };
        batch.update(casterGameDocRef, { worship: newWorship });

        // # FIX: Correctly determine the target slot ID and if it's a self-cast
        const targetSlotId = targetCity ? (targetCity.slotId || targetCity.id) : null;
        console.log("[DivineActions Debug] Determined targetSlotId:", targetSlotId);

        const isSelfCast = !targetCity || targetSlotId === cityGameState.slotId;
        console.log("[DivineActions Debug] Is it a self-cast?", isSelfCast);
        
        let targetGameDocRef;
        let targetGameState;
        const targetOwnerId = isSelfCast ? currentUser.uid : targetCity.ownerId;
        console.log("[DivineActions Debug] Target Owner ID:", targetOwnerId);


        if (isSelfCast) {
            targetGameDocRef = casterGameDocRef;
            targetGameState = currentState;
        } else {
            if (!targetOwnerId) {
                console.error("[DivineActions Debug] Error: targetOwnerId is missing for a non-self cast.");
                setMessage("Target city owner could not be identified.");
                return;
            }
            const citiesRef = collection(db, `users/${targetOwnerId}/games`, worldId, 'cities');
            const q = query(citiesRef, where("slotId", "==", targetSlotId), limit(1));
            console.log(`[DivineActions Debug] Querying for city with slotId: "${targetSlotId}" for user: "${targetOwnerId}"`);

            const cityQuerySnap = await getDocs(q);

            if (cityQuerySnap.empty) {
                console.error("[DivineActions Debug] Firestore query returned no documents. The city was not found.");
                setMessage("Target city's data not found.");
                // # still deduct favor even if target is not found
                await batch.commit(); 
                setCityGameState({ ...cityGameState, worship: newWorship });
                return;
            }
            
            console.log(`[DivineActions Debug] Found ${cityQuerySnap.size} city document(s).`);
            const targetCityDoc = cityQuerySnap.docs[0];
            targetGameDocRef = targetCityDoc.ref;
            targetGameState = targetCityDoc.data();
            console.log("[DivineActions Debug] Target city data loaded successfully:", targetGameState);
        }

        let spellEffectMessage = '', casterMessage = '';

        switch (power.effect.type) {
            case 'add_resources':
            case 'add_multiple_resources': {
                const resourcesToAdd = power.effect.type === 'add_resources' ? { [power.effect.resource]: power.effect.amount } : power.effect.resources;
                const newResources = { ...targetGameState.resources };
                let resourcesReceivedMessage = [];
                for (const resource in resourcesToAdd) {
                    newResources[resource] = (newResources[resource] || 0) + resourcesToAdd[resource];
                    resourcesReceivedMessage.push(`${resourcesToAdd[resource]} ${resource}`);
                }
                batch.update(targetGameDocRef, { resources: newResources });
                casterMessage = isSelfCast ? `You blessed yourself with ${resourcesReceivedMessage.join(' & ')}!` : `You blessed ${targetGameState.cityName} with ${resourcesReceivedMessage.join(' & ')}.`;
                if (!isSelfCast) spellEffectMessage = `Your city ${targetGameState.cityName} was blessed with ${resourcesReceivedMessage.join(' & ')} by ${userProfile.username}!`;
                break;
            }
            case 'damage_building': {
                if (isSelfCast) break;
                const buildings = { ...targetGameState.buildings };
                const buildingKeys = Object.keys(buildings).filter(b => buildings[b].level > 0 && buildingConfig[b].constructible !== false);
                if (buildingKeys.length > 0) {
                    const randomBuildingKey = buildingKeys[Math.floor(Math.random() * buildingKeys.length)];
                    buildings[randomBuildingKey].level = Math.max(0, buildings[randomBuildingKey].level - power.effect.amount);
                    spellEffectMessage = `Your ${buildingConfig[randomBuildingKey]?.name} in ${targetGameState.cityName} was damaged by divine power from ${userProfile.username}!`;
                    casterMessage = `You damaged a building in ${targetGameState.cityName}.`;
                    batch.update(targetGameDocRef, { buildings });
                } else {
                    casterMessage = `You tried to damage a building in ${targetGameState.cityName}, but there were none.`;
                }
                break;
            }
            default: setMessage("Spell effect not implemented."); return;
        }

        const casterReport = { type: 'spell_cast', title: `Spell cast: ${power.name}`, timestamp: serverTimestamp(), outcome: { message: casterMessage }, read: false };
        batch.set(doc(collection(db, `users/${currentUser.uid}/worlds/${worldId}/reports`)), casterReport);
        
        if (!isSelfCast) {
            const targetReport = { type: 'spell_received', title: `Divine Intervention!`, timestamp: serverTimestamp(), outcome: { message: spellEffectMessage, from: cityGameState.cityName }, read: false };
            batch.set(doc(collection(db, `users/${targetOwnerId}/worlds/${worldId}/reports`)), targetReport);
        }

        try {
            await batch.commit();
            setMessage(`${power.name} has been cast!`);
            closeModal('divinePowers');
            if (isSelfCast) setCityGameState((await getDoc(casterGameDocRef)).data());
            else setCityGameState({ ...cityGameState, worship: newWorship });
        } catch (error) {
            console.error("Error casting spell:", error);
            setMessage("Failed to cast spell.");
        }
    };

    return { handleWorshipGod, handleCastSpell };
};
