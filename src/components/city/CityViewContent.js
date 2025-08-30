// src/components/city/CityViewContent.js
import React from 'react';
import SideInfoPanel from '../SideInfoPanel';
import buildingConfig from '../../gameData/buildings.json';
import PhaserCity from './PhaserCity';

const CityViewContent = ({ cityGameState, handlePlotClick, onOpenPowers, gameSettings, movements }) => {

    if (!gameSettings.showVisuals) {
        // Non-visual mode remains for accessibility/performance
        return (
            <main className="flex-grow w-full h-full relative overflow-y-auto p-4">
                <h2 className="text-2xl font-bold mb-4">City Buildings</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(cityGameState.buildings).map(([id, data]) => {
                        if (data.level > 0) {
                            return (
                                <div key={id} className="bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-700" onClick={() => handlePlotClick(id)}>
                                    <p className="font-bold text-lg text-yellow-400">{buildingConfig[id]?.name}</p>
                                    <p>Level {data.level}</p>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
                 <SideInfoPanel
                    gameState={cityGameState}
                    className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20"
                    onOpenPowers={onOpenPowers}
                    movements={movements}
                />
            </main>
        );
    }

    // Visual mode using Phaser
    return (
        <main className="flex-grow w-full h-full relative overflow-hidden">
            <PhaserCity
                cityGameState={cityGameState}
                buildings={cityGameState.buildings}
                onBuildingClick={handlePlotClick}
            />
            <SideInfoPanel
                gameState={cityGameState}
                className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20 flex flex-col gap-4"
                onOpenPowers={onOpenPowers}
                movements={movements}
            />
        </main>
    );
};

export default CityViewContent;
