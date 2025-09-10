import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, serverTimestamp, writeBatch, runTransaction } from 'firebase/firestore';
import tasks from '../gameData/tasks.json';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useNotification } from '../contexts/NotificationContext';

export const useTaskGiverManager = () => {
    const { currentUser } = useAuth();
    const { worldId } = useGame();
    const { addNotification } = useNotification();
    const [activeNPCs, setActiveNPCs] = useState([]);

    // # Spawns a new task-giving NPC if none are present
    const spawnNPC = useCallback(async () => {
        if (!currentUser || !worldId) return;

        const npcsRef = collection(db, 'users', currentUser.uid, 'games', worldId, 'npcs');
        const npcsSnapshot = await getDocs(npcsRef);
        
        const batch = writeBatch(db);
        let activeNpcFound = false;
        
        // # First, clean up any expired NPCs
        npcsSnapshot.forEach(doc => {
            const npc = doc.data();
            const expiresAt = npc.expiresAt?.toDate ? npc.expiresAt.toDate() : new Date(npc.expiresAt);
            if (new Date() > expiresAt) {
                batch.delete(doc.ref);
            } else {
                activeNpcFound = true;
            }
        });
        await batch.commit();

        // # If after cleanup no active NPC is found, spawn a new one
        if (!activeNpcFound) {
            const rand = Math.random();
            let taskType;

            if (rand < 0.05) { // 5% chance for a rare (platinum) quest
                taskType = 'rare';
            } else if (rand < 0.30) { // 25% chance for an uncommon quest
                taskType = 'uncommon';
            } else { // 70% chance for a common quest
                taskType = 'common';
            }

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
        
        // # Finally, reload the active NPCs into state
        const finalNpcsSnapshot = await getDocs(npcsRef);
        setActiveNPCs(finalNpcsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    }, [currentUser, worldId]);

    useEffect(() => {
        // # Check for new NPCs every 5 minutes
        const interval = setInterval(spawnNPC, 5 * 60 * 1000); 
        spawnNPC(); // Initial spawn check

        return () => clearInterval(interval);
    }, [spawnNPC]);
    
    // # Handles the logic when a player accepts a task
    const onAcceptTask = async (npc) => {
        if (!npc || !npc.id || !npc.taskId) return;

        const task = tasks[npc.taskId];
        console.log("Accepted task:", task.description);

        const playerTaskRef = doc(db, `users/${currentUser.uid}/games/${worldId}/playerTasks`, npc.taskId);
        const npcRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'npcs', npc.id);

        try {
            // # Add the task to the player's active tasks and remove the NPC
            await runTransaction(db, async (transaction) => {
                transaction.set(playerTaskRef, {
                    taskId: npc.taskId,
                    status: 'in_progress',
                    startedAt: serverTimestamp()
                });
                transaction.delete(npcRef);
            });
            
            // # Update local state and notify the player
            setActiveNPCs(prev => prev.filter(n => n.id !== npc.id));
            addNotification(`New task started: ${task.title}`, 'quest');

        } catch (error) {
            console.error("Error accepting task:", error);
            addNotification("Could not accept the task.", 'error');
        }
    };

    return { activeNPCs, onAcceptTask };
};

