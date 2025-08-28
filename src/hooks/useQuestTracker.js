// src/hooks/useQuestTracker.js
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, runTransaction, onSnapshot, collection } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext'; 
import allQuests from '../gameData/quests.json';
import { getNationalUnitReward, getGenericUnitType } from '../utils/nationality';

//  get warehouse capacity based on its level
const getWarehouseCapacity = (level) => {
    if (!level) return 0;
    return Math.floor(1500 * Math.pow(1.4, level - 1));
};

export const useQuestTracker = (cityState) => {
    const { currentUser } = useAuth();
    const { worldId, activeCityId, playerCities } = useGame(); // Get worldId and activeCityId from context
    const [questProgress, setQuestProgress] = useState(null);
    const [questEvents, setQuestEvents] = useState({});
    const [quests, setQuests] = useState([]);
    const [isClaiming, setIsClaiming] = useState(false);

    // Fetch quest progress and events from Firestore
    useEffect(() => {
        if (!currentUser || !worldId) return;

        const questDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/quests`, 'progress');
        const unsubscribeProgress = onSnapshot(questDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setQuestProgress(docSnap.data());
            } else {
                const initialProgress = { completed: {}, claimed: {}, active: { 'build_timber_camp_2': true } };
                setDoc(questDocRef, initialProgress).then(() => setQuestProgress(initialProgress));
            }
        });

        const eventsRef = collection(db, `users/${currentUser.uid}/games/${worldId}/questEvents`);
        const unsubscribeEvents = onSnapshot(eventsRef, (snapshot) => {
            const counts = {};
            snapshot.forEach(doc => {
                const type = doc.data().type;
                counts[type] = (counts[type] || 0) + 1;
            });
            setQuestEvents(counts);
        });

        return () => {
            unsubscribeProgress();
            unsubscribeEvents();
        };
    }, [currentUser, worldId]);

    // Update quest status when cityState or progress changes
    useEffect(() => {
        if (!playerCities || !questProgress) {
            setQuests([]);
            return;
        }

        const checkQuestCompletion = (quest, cities) => {
            switch (quest.type) {
                case 'building':
                    return Object.values(cities).some(city => city.buildings[quest.targetId]?.level >= quest.targetLevel);
                case 'units':
                    const totalCount = Object.values(cities).reduce((total, city) => {
                        return total + Object.entries(city.units || {}).reduce((sum, [unitId, count]) => {
                            if (getGenericUnitType(unitId) === quest.targetId || unitId === quest.targetId) {
                                return sum + count;
                            }
                            return sum;
                        }, 0);
                    }, 0);
                    return totalCount >= quest.targetCount;
                case 'attack_village':
                case 'attack_player':
                    return (questEvents[quest.type] || 0) >= quest.targetCount;
                default:
                    return false;
            }
        };

        const updatedQuests = Object.entries(allQuests)
            .filter(([id]) => questProgress.active?.[id])
            .map(([id, questData]) => {
                const isComplete = questProgress.completed[id] || checkQuestCompletion(questData, playerCities);
                return {
                    id,
                    ...questData,
                    isComplete,
                    isClaimed: !!questProgress.claimed[id],
                };
            });

        setQuests(updatedQuests);
    }, [playerCities, questProgress, questEvents]);

    const claimReward = useCallback(async (questId) => {
        if (isClaiming) return;
        if (!currentUser || !worldId || !activeCityId) return;

        const quest = quests.find(q => q.id === questId);
        if (!quest || !quest.isComplete || quest.isClaimed) {
            console.error("Quest not available for claiming.");
            return;
        }

        setIsClaiming(true);

        const cityDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/cities`, activeCityId);
        const questDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/quests`, 'progress');
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                const questDoc = await transaction.get(questDocRef);
                const gameDoc = await transaction.get(gameDocRef);

                if (!cityDoc.exists() || !questDoc.exists() || !gameDoc.exists()) {
                    throw new Error("City, quest, or game data not found.");
                }

                const cityData = cityDoc.data();
                const questData = questDoc.data();
                const gameData = gameDoc.data();
                const capacity = getWarehouseCapacity(cityData.buildings.warehouse?.level);

                // Apply rewards
                const newResources = { ...cityData.resources };
                const newUnits = { ...cityData.units };
                const newItems = { ...(gameData.items || {}) };
                const playerNation = cityData.playerInfo?.nation;

                if (quest.rewards.resources) {
                    for (const resource in quest.rewards.resources) {
                        newResources[resource] = Math.min(capacity, (newResources[resource] || 0) + quest.rewards.resources[resource]);
                    }
                }
                if (quest.rewards.units) {
                    for (const unit in quest.rewards.units) {
                        if (unit.startsWith('generic_')) {
                            if (!playerNation) continue;
                            const nationalUnitId = getNationalUnitReward(playerNation, unit);
                            newUnits[nationalUnitId] = (newUnits[nationalUnitId] || 0) + quest.rewards.units[unit];
                        } else {
                            newUnits[unit] = (newUnits[unit] || 0) + quest.rewards.units[unit];
                        }
                    }
                }
                if (quest.rewards.items) {
                    for (const item in quest.rewards.items) {
                        newItems[item] = (newItems[item] || 0) + quest.rewards.items[item];
                    }
                }

                // Update quest progress
                const newQuestProgress = { ...questData };
                newQuestProgress.claimed[questId] = true;
                if (!newQuestProgress.completed[questId]) {
                    newQuestProgress.completed[questId] = true;
                }
                
                // Unlock next quest(s)
                if (quest.nextQuests) { // The new array property
                    quest.nextQuests.forEach(nextId => {
                        // Only activate if not already completed
                        if (!newQuestProgress.completed[nextId]) {
                            newQuestProgress.active[nextId] = true;
                        }
                    });
                } else if (quest.nextQuest) { // Fallback for old format
                    if (!newQuestProgress.completed[quest.nextQuest]) {
                        newQuestProgress.active[quest.nextQuest] = true;
                    }
                }

                transaction.update(cityDocRef, { resources: newResources, units: newUnits });
                transaction.update(gameDocRef, { items: newItems });
                transaction.set(questDocRef, newQuestProgress);
            });
        } catch (error) {
            console.error("Error claiming quest reward:", error);
        } finally {
            setIsClaiming(false);
        }
    }, [currentUser, worldId, activeCityId, quests, isClaiming]);

    return { quests, claimReward, isClaiming };
};
