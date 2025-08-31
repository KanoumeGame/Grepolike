import React from 'react';

const MapImageViewer = ({ imageUrl, worldName, onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-80" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-4 w-11/12 h-5/6 max-w-6xl border-2 border-gray-600 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-2xl text-white">{worldName.replace('-map.png', '')} Map</h3>
                    <div>
                        <a href={imageUrl} download={worldName} className="btn btn-confirm mr-4">Download</a>
                        <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                    </div>
                </div>
                <div className="flex-grow overflow-auto">
                    <img src={imageUrl} alt="World Map" className="max-w-full h-auto mx-auto" />
                </div>
            </div>
        </div>
    );
};

export default MapImageViewer;
