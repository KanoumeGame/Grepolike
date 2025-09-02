import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import itemsConfig from '../../gameData/items.json';
import shopItems from '../../gameData/shopItems';

export const useShopActions = () => {
    const { currentUser } = useAuth();
    const { worldId, addNotification } = useGame();

    const purchaseItem = async (item, village) => {
        if (!currentUser || !worldId || !village.id) {
            throw new Error("User, world, or village not identified.");
        }

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameDocRef);
            if (!gameDoc.exists()) throw new Error("Game data not found.");

            const gameData = gameDoc.data();
            const currentRunecoins = gameData.runecoins || 0;

            if (currentRunecoins < item.cost) {
                throw new Error("Not enough Runecoins.");
            }

            const newRunecoins = currentRunecoins - item.cost;
            const newItems = { ...(gameData.items || {}) };
            newItems[item.itemId] = (newItems[item.itemId] || 0) + 1;

            transaction.update(gameDocRef, {
                runecoins: newRunecoins,
                items: newItems
            });
        });

        addNotification(`Purchased ${itemsConfig[item.itemId].name}!`, 'item', item.itemId);
    };
    
    const sellItem = async (itemId, village) => {
        if (!currentUser || !worldId || !village.id) {
            throw new Error("User, world, or village not identified.");
        }
        
        const itemInfo = Object.values(shopItems).flat().find(i => i.itemId === itemId);
        if (!itemInfo || !itemInfo.sellPrice) {
            throw new Error("This item cannot be sold or has no sell price.");
        }
        const sellPrice = itemInfo.sellPrice;

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const villageDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'conqueredVillages', village.id);

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameDocRef);
            const villageDoc = await transaction.get(villageDocRef);
            if (!gameDoc.exists() || !villageDoc.exists()) throw new Error("Game or village data not found.");

            const gameData = gameDoc.data();
            const villageData = villageDoc.data();

            const currentItems = gameData.items || {};
            if ((currentItems[itemId] || 0) < 1) {
                throw new Error("You don't have this item to sell.");
            }
            
            const villageRunecoins = villageData.runecoinBalance || 0;
            if (villageRunecoins < sellPrice) {
                throw new Error("The village cannot afford this item.");
            }

            // Perform updates
            const newRunecoins = (gameData.runecoins || 0) + sellPrice;
            const newItems = { ...currentItems };
            newItems[itemId] -= 1;
            if (newItems[itemId] === 0) {
                delete newItems[itemId];
            }
            const newVillageRunecoins = villageRunecoins - sellPrice;

            transaction.update(gameDocRef, { runecoins: newRunecoins, items: newItems });
            transaction.update(villageDocRef, { runecoinBalance: newVillageRunecoins });
        });

        addNotification(`Sold ${itemsConfig[itemId].name} for ${sellPrice} Runecoins!`, 'item', itemId);
    };

    const refreshShop = async (village) => {
        if (!currentUser || !worldId || !village.id) {
            throw new Error("User, world, or village not identified.");
        }
        
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const villageDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'conqueredVillages', village.id);

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameDocRef);
            if (!gameDoc.exists()) throw new Error("Game data not found.");
            
            const gameData = gameDoc.data();
            const lastRefresh = gameData.lastManualShopRefresh?.toDate();
            const now = new Date();
            
            if (lastRefresh && lastRefresh.toDateString() === now.toDateString()) {
                throw new Error("You can only refresh the shop once per day.");
            }
            
            transaction.update(gameDocRef, { lastManualShopRefresh: serverTimestamp() });
            transaction.update(villageDocRef, { lastShopRefresh: now.getTime() });
        });
        
        addNotification('Shop items have been refreshed!', 'vip', 1);
    };

    return { purchaseItem, refreshShop, sellItem };
};

