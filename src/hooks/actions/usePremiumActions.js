/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
// src/hooks/actions/usePremiumActions.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction } from "firebase/firestore";

export const usePremiumActions = () => {
    const { currentUser } = useAuth();
    const { worldId, playerGameData, addNotification } = useGame();

    const spendPlatinum = async (amount) => {
        if (!playerGameData || (playerGameData.platinum || 0) < amount) {
            throw new Error("Not enough platinum.");
        }
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameDocRef);
            if (!gameDoc.exists()) throw new Error("Game data not found.");
            const currentPlatinum = gameDoc.data().platinum || 0;
            if (currentPlatinum < amount) throw new Error("Not enough platinum.");
            transaction.update(gameDocRef, { platinum: currentPlatinum - amount });
        });
    };

    const speedUpBuilding = async (queueItem, cityState, saveGameState) => {
        const cost = 50; // Cost 50 platinum to speed up
        try {
            await spendPlatinum(cost);

            const newQueue = cityState.buildQueue.map(item => {
                if (item.id === queueItem.id) {
                    const remainingTime = new Date(item.endTime).getTime() - Date.now();
                    const newEndTime = new Date(Date.now() + remainingTime / 2);
                    return { ...item, endTime: newEndTime };
                }
                return item;
            });

            const newState = { ...cityState, buildQueue: newQueue };
            await saveGameState(newState);
            addNotification("Building construction accelerated by 50%!", 'building', queueItem.buildingId);
        } catch (error) {
            addNotification(error.message, 'error');
            console.error("Failed to speed up building:", error);
        }
    };

    const speedUpTraining = async (queueItem, queueType, cityState, saveGameState) => {
        const cost = 50;
        try {
            await spendPlatinum(cost);

            const queueName = `${queueType}Queue`;
            const newQueue = cityState[queueName].map(item => {
                if (item.id === queueItem.id) {
                    const remainingTime = new Date(item.endTime).getTime() - Date.now();
                    const newEndTime = new Date(Date.now() + remainingTime / 2);
                    return { ...item, endTime: newEndTime };
                }
                return item;
            });

            const newState = { ...cityState, [queueName]: newQueue };
            await saveGameState(newState);
            addNotification("Troop training accelerated by 50%!", 'unit', queueItem.unitId);
        } catch (error) {
            addNotification(error.message, 'error');
            console.error("Failed to speed up training:", error);
        }
    };

    const healHero = async (heroId, cityState, saveGameState) => {
        const cost = 100;
        try {
            await spendPlatinum(cost);

            const newHeroes = { ...cityState.heroes };
            if (newHeroes[heroId]) {
                delete newHeroes[heroId].woundedUntil;
            }

            const newState = { ...cityState, heroes: newHeroes };
            await saveGameState(newState);
            addNotification("Your hero has been fully healed!", 'hero', heroId);
        } catch (error) {
            addNotification(error.message, 'error');
            console.error("Failed to heal hero:", error);
        }
    };

    return { speedUpBuilding, speedUpTraining, healHero };
};
