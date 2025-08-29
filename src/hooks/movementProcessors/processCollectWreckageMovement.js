import { doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

// # Processes the arrival of a 'collect_wreckage' movement
export const processCollectWreckageMovement = async (movement, movementDoc, worldId) => {
    const batch = writeBatch(db);
    const wreckageRef = doc(db, 'worlds', worldId, 'wreckages', movement.targetWreckageId);
    const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);

    const [wreckageSnap, originCitySnap] = await Promise.all([
        getDoc(wreckageRef),
        getDoc(originCityRef)
    ]);

    if (!originCitySnap.exists()) {
        // Origin city might have been destroyed, just delete movement
        batch.delete(movementDoc.ref);
        await batch.commit();
        return;
    }

    let collectedResources = {};
    if (wreckageSnap.exists()) {
        collectedResources = wreckageSnap.data().resources;
        batch.delete(wreckageRef); // Wreckage is collected and disappears
    }

    // Create a return movement for the ships, carrying the resources
    const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
    const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
    batch.update(movementDoc.ref, {
        status: 'returning',
        units: movement.units,
        resources: collectedResources,
        arrivalTime: returnArrivalTime,
    });

    // Generate a report for the player
    const reportMessage = wreckageSnap.exists()
        ? `Your collection party successfully retrieved ${Object.entries(collectedResources).map(([res, amount]) => `${amount.toLocaleString()} ${res}`).join(', ')} from the sea.`
        : 'Your collection party arrived at the location, but the resources were already gone.';

    const report = {
        type: 'collect_wreckage',
        title: 'Sea Resources Collected',
        timestamp: serverTimestamp(),
        outcome: { message: reportMessage, resources: collectedResources },
        read: false,
    };
    const reportRef = doc(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`, `${movement.id}-collect`);
    batch.set(reportRef, report);

    await batch.commit();
};
