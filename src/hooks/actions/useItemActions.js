/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
// src/hooks/actions/useItemActions.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction } from "firebase/firestore";
import itemsConfig from '../../gameData/items.json';

export const useItemActions = () => {
    const { currentUser } = useAuth();
    const { worldId } = useGame();

    const activateItem = async (itemId) => {
        if (!currentUser || !worldId) {
            throw new Error("User or world not identified.");
        }

        const item = itemsConfig[itemId];
        if (!item) {
            throw new Error("Item not found.");
        }

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        try {
            await runTransaction(db, async (transaction) => {
                const gameDoc = await transaction.get(gameDocRef);
                if (!gameDoc.exists()) {
                    throw new Error("Player game data not found.");
                }

                const gameData = gameDoc.data();
                const currentItems = gameData.items || {};

                if (!currentItems[itemId] || currentItems[itemId] <= 0) {
                    throw new Error("You do not have this item.");
                }

                // Decrement item count
                const newItems = { ...currentItems };
                newItems[itemId] -= 1;
                if (newItems[itemId] === 0) {
                    delete newItems[itemId];
                }

                // Apply boost
                const newActiveBoosts = { ...(gameData.activeBoosts || {}) };
                const effect = item.effect;
                const boostKey = `${effect.type}${effect.resource ? `_${effect.resource}` : ''}`;
                
                newActiveBoosts[boostKey] = {
                    value: effect.value,
                    expires: new Date(Date.now() + effect.duration * 1000)
                };

                transaction.update(gameDocRef, {
                    items: newItems,
                    activeBoosts: newActiveBoosts
                });
            });
        } catch (error) {
            console.error("Error using item:", error);
            throw error;
        }
    };

    return { activateItem };
};
