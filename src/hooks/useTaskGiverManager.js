import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, serverTimestamp, writeBatch, runTransaction, updateDoc } from 'firebase/firestore';
import tasks from '../gameData/tasks.json';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useNotification } from '../contexts/NotificationContext';
import unitConfig from '../gameData/units.json';

// Get warehouse capacity based on its level
const getWarehouseCapacity = (level) => {
    if (!level) return 0;
    return Math.floor(1500 * Math.pow(1.4, level - 1));
};

export const useTaskGiverManager = () => {
    const { currentUser } = useAuth();
    const { worldId, addNotification, playerCities, playerGameData } = useGame();
    const [activeNPCs, setActiveNPCs] = useState([]);

    const abandonPlayerTask = useCallback(async (taskToAbandon) => {
        if (!currentUser || !worldId || !taskToAbandon) return;

        const playerTaskRef = doc(db, `users/${currentUser.uid}/games/${worldId}/playerTasks`, taskToAbandon.id);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        const penaltyDuration = 30 * 60 * 1000; // 30 minutes penalty
        const penaltyEnds = new Date(Date.now() + penaltyDuration);

        const batch = writeBatch(db);
        batch.delete(playerTaskRef);
        batch.update(gameDocRef, { nextNpcSpawnAvailableAfter: penaltyEnds });
        
        await batch.commit();

        addNotification(`Task "${tasks[taskToAbandon.taskId].title}" was abandoned. You received a 30-minute penalty for new NPC spawns.`, 'error');
    }, [currentUser, worldId, addNotification]);

    const spawnNPC = useCallback(async () => {
        if (!currentUser || !worldId) return;

        const npcsRef = collection(db, 'users', currentUser.uid, 'games', worldId, 'npcs');
        const tasksRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'playerTasks');
        
        const [npcsSnapshot, tasksSnapshot, gameDoc] = await Promise.all([
            getDocs(npcsRef),
            getDocs(tasksRef),
            getDoc(doc(db, `users/${currentUser.uid}/games`, worldId))
        ]);

        const gameData = gameDoc.exists() ? gameDoc.data() : {};
        const now = new Date();

        if (gameData.nextNpcSpawnAvailableAfter && now < gameData.nextNpcSpawnAvailableAfter.toDate()) {
            console.log("NPC spawn is on cooldown due to a penalty.");
            return;
        }

        const batch = writeBatch(db);
        let activeNpcFound = false;
        
        npcsSnapshot.forEach(doc => {
            const npc = doc.data();
            const expiresAt = npc.expiresAt?.toDate ? npc.expiresAt.toDate() : new Date(npc.expiresAt);
            if (now > expiresAt) {
                batch.delete(doc.ref);
            } else {
                activeNpcFound = true;
            }
        });

        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            const expiresAt = task.expiresAt?.toDate ? task.expiresAt.toDate() : new Date(task.expiresAt);
            if (now > expiresAt) {
                abandonPlayerTask({ id: doc.id, ...task });
            }
        });
        
        await batch.commit();

        if (!activeNpcFound && tasksSnapshot.size === 0) {
            const rand = Math.random();
            let taskType;

            if (rand < 0.05) taskType = 'rare';
            else if (rand < 0.30) taskType = 'uncommon';
            else taskType = 'common';

            const availableTasks = Object.keys(tasks).filter(id => tasks[id].rarity === taskType);
            if (availableTasks.length === 0) return;

            const taskId = availableTasks[Math.floor(Math.random() * availableTasks.length)];
            const npcId = `npc-${Date.now()}`;
            const newNpc = {
                id: npcId,
                taskId: taskId,
                spawnedAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
                sprite: {
                    sheet: 'guests/person_placeholder.png',
                    y: 0  
                }
            };
            
            await setDoc(doc(npcsRef, npcId), newNpc);
        }
        
        const finalNpcsSnapshot = await getDocs(npcsRef);
        setActiveNPCs(finalNpcsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    }, [currentUser, worldId, abandonPlayerTask]);

    useEffect(() => {
        const interval = setInterval(spawnNPC, 5 * 60 * 1000); 
        spawnNPC();
        return () => clearInterval(interval);
    }, [spawnNPC]);
    
    const onAcceptTask = async (npc) => {
        if (!npc || !npc.id || !npc.taskId) return;
        const task = tasks[npc.taskId];
        const playerTaskRef = doc(db, `users/${currentUser.uid}/games/${worldId}/playerTasks`, npc.taskId);
        const npcRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'npcs', npc.id);

        try {
            await runTransaction(db, async (transaction) => {
                transaction.set(playerTaskRef, {
                    taskId: npc.taskId,
                    status: 'in_progress',
                    startedAt: serverTimestamp(),
                    expiresAt: new Date(Date.now() + task.timeLimit * 1000),
                    contributions: {}
                });
                transaction.delete(npcRef);
            });
            
            setActiveNPCs(prev => prev.filter(n => n.id !== npc.id));
            addNotification(`New task started: ${task.title}`, 'quest');

        } catch (error) {
            console.error("Error accepting task:", error);
            addNotification("Could not accept the task.", 'error');
        }
    };

    const completePlayerTask = async (activeTask, contributions) => {
        if (!activeTask || !activeTask.taskId) return;
        const taskInfo = tasks[activeTask.taskId];
        const cityId = Object.keys(playerCities)[0]; // Complete from the first city
        if (!cityId) {
            addNotification("You need a city to complete tasks.", 'error');
            return;
        }
        const cityDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/cities`, cityId);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const playerTaskRef = doc(db, `users/${currentUser.uid}/games/${worldId}/playerTasks`, activeTask.id);

        await runTransaction(db, async (transaction) => {
            const cityDoc = await transaction.get(cityDocRef);
            const gameDoc = await transaction.get(gameDocRef);
            if (!cityDoc.exists() || !gameDoc.exists()) throw new Error("City or game data not found.");

            const cityData = cityDoc.data();
            const gameData = gameDoc.data();
            const newResources = { ...cityData.resources };
            const newUnits = { ...cityData.units };
            const req = taskInfo.requirement;

            // Deduct requirements
            if (req.type === 'wood' || req.type === 'stone' || req.type === 'silver') {
                newResources[req.type] -= req.amount;
            } else {
                newUnits[req.type] -= req.amount;
            }

            // Grant rewards
            const reward = taskInfo.reward;
            const capacity = getWarehouseCapacity(cityData.buildings.warehouse?.level);
            if (reward.type === 'resources') {
                for (const res in reward.amount) {
                    newResources[res] = Math.min(capacity, (newResources[res] || 0) + reward.amount[res]);
                }
            } else if (reward.type === 'platinum') {
                const currentPlatinum = gameData.platinum || 0;
                transaction.update(gameDocRef, { platinum: currentPlatinum + reward.amount });
            } else if (reward.type === 'runecoins') {
                 const currentRunecoins = gameData.runecoins || 0;
                transaction.update(gameDocRef, { runecoins: currentRunecoins + reward.amount });
            }
            
            transaction.update(cityDocRef, { resources: newResources, units: newUnits });
            transaction.delete(playerTaskRef);
        });
        
        addNotification(`Task "${taskInfo.title}" completed!`, 'success');
    };

    return { activeNPCs, onAcceptTask, completePlayerTask, abandonPlayerTask };
};
