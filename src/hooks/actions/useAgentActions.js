/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
// src/hooks/actions/useAgentActions.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import agentsConfig from '../../gameData/agents.json';
import { calculateDistance, calculateTravelTime } from '../../utils/travel';

//  Handles actions related to agents like recruiting.
export const useAgentActions = (cityGameState, saveGameState, setMessage) => {
    const { currentUser } = useAuth();
    const { worldId, activeCityId, worldState } = useGame();

    //  Logic to recruit a new agent.
    const onRecruitAgent = async (agentId) => {
        const agent = agentsConfig[agentId];
        if (!agent) return;

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");
                const cityData = cityDoc.data();

                if (cityData.resources.wood < agent.cost.wood) throw new Error("Not enough wood.");
                if (cityData.resources.stone < agent.cost.stone) throw new Error("Not enough stone.");
                if (cityData.resources.silver < agent.cost.silver) throw new Error("Not enough silver.");

                const newResources = {
                    ...cityData.resources,
                    wood: cityData.resources.wood - agent.cost.wood,
                    stone: cityData.resources.stone - agent.cost.stone,
                    silver: cityData.resources.silver - agent.cost.silver
                };

                const newAgents = {
                    ...cityData.agents,
                    [agentId]: (cityData.agents?.[agentId] || 0) + 1
                };

                transaction.update(cityDocRef, { resources: newResources, agents: newAgents });
            });
            setMessage(`${agent.name} has been recruited!`);
        } catch (error) {
            setMessage(`Failed to recruit agent: ${error.message}`);
        }
    };

    //  Sends a liberator agent to free a captured hero.
    const onSendLiberator = async (heroToFree, targetCityData, silverAmount) => {
        if (!cityGameState || !heroToFree || !targetCityData || silverAmount <= 0) {
            setMessage("Invalid data for rescue mission.");
            return;
        }

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("Your city data could not be found.");

                const cityData = cityDoc.data();
                if ((cityData.agents?.liberator || 0) < 1) {
                    throw new Error("You do not have a Liberator agent available.");
                }
                if ((cityData.cave?.silver || 0) < silverAmount) {
                    throw new Error("Not enough silver in your cave.");
                }

                // Consume agent and silver
                const newAgents = { ...cityData.agents, liberator: cityData.agents.liberator - 1 };
                const newCave = { ...cityData.cave, silver: cityData.cave.silver - silverAmount };
                transaction.update(cityDocRef, { agents: newAgents, cave: newCave });

                // Create movement
                const distance = calculateDistance(cityData, targetCityData);
                const travelSeconds = calculateTravelTime(distance, 5, 'free_hero', worldState, ['land']);
                const arrivalTime = new Date(Date.now() + travelSeconds * 1000);

                const movementData = {
                    type: 'free_hero',
                    status: 'moving',
                    originCityId: activeCityId,
                    originOwnerId: currentUser.uid,
                    originCityName: cityData.cityName,
                    originCoords: { x: cityData.x, y: cityData.y },
                    targetCityId: targetCityData.id,
                    targetSlotId: targetCityData.slotId,
                    targetOwnerId: targetCityData.ownerId,
                    targetCityName: targetCityData.cityName,
                    targetCoords: { x: targetCityData.x, y: targetCityData.y },
                    heroToFreeId: heroToFree.heroId,
                    heroOwnerId: heroToFree.ownerId,
                    silverAmount: silverAmount,
                    departureTime: serverTimestamp(),
                    arrivalTime: arrivalTime,
                    involvedParties: [currentUser.uid, targetCityData.ownerId]
                };
                transaction.set(newMovementRef, movementData);
            });
            setMessage(`A Liberator has been dispatched to ${targetCityData.cityName}.`);
        } catch (error) {
            setMessage(`Mission failed to start: ${error.message}`);
            console.error(error);
        }
    };

    //  Placeholder for assigning an agent.
    const onAssignAgent = async (agentId) => {
        setMessage(`${agentsConfig[agentId].name} is ready for duty.`);
    };

    return { onRecruitAgent, onAssignAgent, onSendLiberator };
};
