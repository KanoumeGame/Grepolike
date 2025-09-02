// src/hooks/useVillageState.js
import { useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, runTransaction, serverTimestamp, collection, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export const useVillageState = (worldId) => {
    const { currentUser } = useAuth();

    // Effect for Runecoin generation (needs transaction)
    useEffect(() => {
        if (!currentUser || !worldId) return;

        const processRunecoinGeneration = async () => {
            const conqueredVillagesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'conqueredVillages');
            const snapshot = await getDocs(conqueredVillagesRef);
            
            snapshot.forEach(async (villageDoc) => {
                const villageData = villageDoc.data();
                const now = Date.now();
                const lastUpdate = villageData.lastRunecoinUpdate?.toDate().getTime() || now;
                const hoursPassed = (now - lastUpdate) / (1000 * 60 * 60);

                if (hoursPassed >= 1) {
                    const runecoinsToAdd = Math.floor(hoursPassed);
                    const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

                    await runTransaction(db, async (transaction) => {
                        const gameDoc = await transaction.get(gameDocRef);
                        if (!gameDoc.exists()) return;
                        const currentRunecoins = gameDoc.data().runecoins || 0;
                        transaction.update(gameDocRef, { runecoins: currentRunecoins + runecoinsToAdd });
                        transaction.update(villageDoc.ref, { lastRunecoinUpdate: serverTimestamp() });
                    });
                }
            });
        };

        const interval = setInterval(processRunecoinGeneration, 60 * 60 * 1000); // Check every hour
        return () => clearInterval(interval);

    }, [currentUser, worldId]);

    // Effect for Shop Refresh and Village Runecoin balance
    useEffect(() => {
        if (!currentUser || !worldId) return;

        const processVillageUpdates = async () => {
            const villagesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'conqueredVillages');
            const snapshot = await getDocs(villagesRef);
            const now = Date.now();
            const batch = writeBatch(db);
            let updatesMade = false;
            const eightHoursInMillis = 8 * 60 * 60 * 1000;

            snapshot.forEach((villageDoc) => {
                const villageData = villageDoc.data();
                const lastRefreshTime = villageData.lastShopRefresh?.toDate 
                    ? villageData.lastShopRefresh.toDate().getTime() 
                    : villageData.lastShopRefresh;

                if (!lastRefreshTime) {
                    batch.update(villageDoc.ref, { lastShopRefresh: now });
                    updatesMade = true;
                } else if (now - lastRefreshTime > eightHoursInMillis) {
                    batch.update(villageDoc.ref, { lastShopRefresh: now });
                    updatesMade = true;
                }

                // Village Runecoin balance regeneration
                const lastReset = villageData.lastRunecoinReset?.toDate().getTime();
                if (!lastReset) {
                    const resetInterval = (5 + Math.random() * 2) * 24 * 60 * 60 * 1000; // 5-7 days
                    const baseBalance = 200 + (villageData.level || 1) * 50;
                    batch.update(villageDoc.ref, { 
                        runecoinBalance: baseBalance, 
                        lastRunecoinReset: serverTimestamp(),
                        runecoinResetInterval: resetInterval 
                    });
                    updatesMade = true;
                } else {
                    const resetInterval = villageData.runecoinResetInterval || (6 * 24 * 60 * 60 * 1000); // Default to 6 if not set
                    if (now - lastReset > resetInterval) {
                        const baseBalance = 200 + (villageData.level || 1) * 50;
                        batch.update(villageDoc.ref, { 
                            runecoinBalance: baseBalance, 
                            lastRunecoinReset: serverTimestamp() 
                        });
                        updatesMade = true;
                    }
                }
            });
            
            if (updatesMade) {
                await batch.commit();
            }
        };

        const interval = setInterval(processVillageUpdates, 60 * 1000); // Check every minute
        processVillageUpdates(); // Also run once on load
        return () => clearInterval(interval);
    }, [currentUser, worldId]);
};

