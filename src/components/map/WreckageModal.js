import React from 'react';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';

const WreckageModal = ({ wreckage, onClose, onCollect }) => {
    if (!wreckage) return null;

    const resourceType = Object.keys(wreckage.resources)[0];
    const resourceAmount = wreckage.resources[resourceType];

    const resourceImages = {
        wood: woodImage,
        stone: stoneImage,
        silver: silverImage,
    };

    // Triggers the action to open the movement modal
    const handleCollect = () => {
        onCollect('collect_wreckage', { ...wreckage, isWreckageTarget: true, name: 'Sea Resources' });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4">Sea Resources</h3>
                <p className="mb-4">A shipwreck's cargo is floating on the waves, waiting to be collected.</p>
                <div className="flex items-center justify-center bg-gray-700 p-4 rounded-lg">
                    <img src={resourceImages[resourceType]} alt={resourceType} className="w-12 h-12 mr-4" />
                    <div>
                        <p className="text-lg font-bold capitalize">{resourceType}</p>
                        <p className="text-xl text-yellow-400">{resourceAmount.toLocaleString()}</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={handleCollect} className="btn btn-primary">
                        Send Collection Party
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WreckageModal;