/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { db } from '../firebase/config';
import { doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import vipConfig from '../gameData/vip.json';
import itemsConfig from '../gameData/items.json';
import './VipDisplay.css';

//  Determines the loot from a VIP chest based on the player's VIP level.
const getVipChestLoot = (vipLevel) => {
    const commonItems = ["resource_boost_wood_25", "construction_speed_10", "research_speed_10"];
    const rareItems = ["training_speed_10", "attack_boost_5", "defense_boost_5", "movement_speed_10"];

    let chestType;
    if (vipLevel >= 15) chestType = 'Divine';
    else if (vipLevel >= 10) chestType = 'Gold';
    else if (vipLevel >= 5) chestType = 'Silver';
    else chestType = 'Bronze';

    const loot = {};
    let lootMessage = `You opened a ${chestType} Chest and found: `;
    const foundItems = [];

    switch (chestType) {
        case 'Divine': {
            const item = rareItems[Math.floor(Math.random() * rareItems.length)];
            loot[item] = (loot[item] || 0) + 1;
            foundItems.push(itemsConfig[item].name);
            if (Math.random() < 0.25) {
                const extraItem = rareItems[Math.floor(Math.random() * rareItems.length)];
                loot[extraItem] = (loot[extraItem] || 0) + 1;
                foundItems.push(itemsConfig[extraItem].name);
            }
            break;
        }
        case 'Gold': {
            const item = rareItems[Math.floor(Math.random() * rareItems.length)];
            loot[item] = (loot[item] || 0) + 1;
            foundItems.push(itemsConfig[item].name);
            break;
        }
        case 'Silver': {
            const item = commonItems[Math.floor(Math.random() * commonItems.length)];
            loot[item] = (loot[item] || 0) + 1;
            foundItems.push(itemsConfig[item].name);
            if (Math.random() < 0.1) {
                const extraItem = rareItems[Math.floor(Math.random() * rareItems.length)];
                loot[extraItem] = (loot[extraItem] || 0) + 1;
                foundItems.push(itemsConfig[extraItem].name);
            }
            break;
        }
        case 'Bronze':
        default: {
            const item = commonItems[Math.floor(Math.random() * commonItems.length)];
            loot[item] = (loot[item] || 0) + 1;
            foundItems.push(itemsConfig[item].name);
            break;
        }
    }
    lootMessage += foundItems.join(', ');
    return { loot, lootMessage };
};

const VipDisplay = () => {
    const { currentUser } = useAuth();
    const { worldId, playerGameData, addNotification } = useGame();
    const [canClaim, setCanClaim] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);

    useEffect(() => {
        if (playerGameData?.lastVipPointsClaimed) {
            const lastClaimDate = playerGameData.lastVipPointsClaimed.toDate();
            const now = new Date();
            if (now.getDate() !== lastClaimDate.getDate() || now.getMonth() !== lastClaimDate.getMonth() || now.getFullYear() !== lastClaimDate.getFullYear()) {
                setCanClaim(true);
            } else {
                setCanClaim(false);
            }
        } else if (playerGameData) {
            setCanClaim(true);
        }
    }, [playerGameData]);

    const handleClaimVipPoints = async () => {
        if (!canClaim || isClaiming || !playerGameData) return;
        setIsClaiming(true);

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const currentPoints = playerGameData.vipPoints || 0;
        const newPoints = currentPoints + vipConfig.dailyPoints;
        let newLevel = playerGameData.vipLevel || 1;

        if (newLevel < vipConfig.pointsPerLevel.length && newPoints >= vipConfig.pointsPerLevel[newLevel]) {
            newLevel++;
        }

        const { loot, lootMessage } = getVipChestLoot(newLevel);

        try {
            await runTransaction(db, async (transaction) => {
                const gameDoc = await transaction.get(gameDocRef);
                if (!gameDoc.exists()) throw new Error("Game data not found.");

                const gameData = gameDoc.data();
                const newItems = { ...(gameData.items || {}) };
                for (const itemId in loot) {
                    newItems[itemId] = (newItems[itemId] || 0) + loot[itemId];
                }

                transaction.update(gameDocRef, {
                    vipPoints: newPoints,
                    vipLevel: newLevel,
                    lastVipPointsClaimed: serverTimestamp(),
                    items: newItems
                });
            });

            addNotification(lootMessage, 'vip', newLevel);

        } catch (error) {
            console.error("Error claiming VIP points:", error);
        } finally {
            setIsClaiming(false);
        }
    };
    
    const vipLevel = playerGameData?.vipLevel || 1;
    const currentVipPoints = playerGameData?.vipPoints || 0;
    const pointsForNextLevel = vipConfig.pointsPerLevel[vipLevel] || Infinity;
    const progress = pointsForNextLevel === Infinity ? 100 : (currentVipPoints / pointsForNextLevel) * 100;

    return (
        <div className="vip-container">
            <div className="vip-header">
                <span>VIP {vipLevel}</span>
                {canClaim && <button className="vip-claim-btn" onClick={handleClaimVipPoints} disabled={isClaiming}>Claim Chest</button>}
            </div>
            <div className="vip-progress-bar-bg" title={`${currentVipPoints} / ${pointsForNextLevel === Infinity ? 'MAX' : pointsForNextLevel} VIP Points`}>
                <div className="vip-progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
    );
};

export default VipDisplay;
