import React, { useState, useEffect } from 'react';

// # Component to render an animated NPC sprite
const NpcSprite = ({ npc, handleOpenTaskGiver, buildingImages }) => {
    const [currentFrame, setCurrentFrame] = useState(0);

    // This effect creates an interval to animate the sprite
    useEffect(() => {
        const animationInterval = setInterval(() => {
            // Toggles the frame between 0 and 1
            setCurrentFrame(prevFrame => (prevFrame + 1) % 2); 
        }, 800); // Change frame every 800ms for a slow walking animation

        // Cleanup the interval when the component unmounts
        return () => clearInterval(animationInterval);
    }, []);

    // Don't render if sprite or position data is missing
    if (!npc.sprite || !npc.position) return null;

    const { sheet } = npc.sprite;
    const spriteSheetUrl = buildingImages[sheet];
    
    if (!spriteSheetUrl) return null;

    // Style object for the sprite div
    const spriteStyle = {
        top: `${npc.position.top}px`,
        left: `${npc.position.left}px`,
        backgroundImage: `url(${spriteSheetUrl})`,
        // The spritesheet has 2 frames horizontally.
        // The background is 200% wide to contain both frames.
        // We switch between 0% and 100% position to show the correct frame.
        backgroundPosition: `${currentFrame * 100}% 0%`,
        backgroundSize: '200% 100%',
        width: '64px', // Width of a single frame
        height: '64px', // Height of a single frame
    };

    return (
        <div 
            key={npc.id}
            className="absolute cursor-pointer hover:animate-pulse z-10"
            style={spriteStyle}
            onClick={() => handleOpenTaskGiver(npc)}
            title="A mysterious stranger has a task for you."
        />
    );
};

export default NpcSprite;
