/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
import React, { useEffect, useState } from 'react';
import './Notification.css';
import buildingConfig from '../../gameData/buildings.json';
import unitConfig from '../../gameData/units.json';

//  Dynamically import all images
const images = {};
const imageContexts = [
    require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/),
    require.context('../../images/buildings', false, /\.(png|jpe?g|svg)$/),
];
imageContexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        images[key] = context(item);
    });
});

const Notification = ({ id, message, iconType, iconId, onClose }) => {
    const [iconSrc, setIconSrc] = useState('');

    useEffect(() => {
        let imagePath = '';
        if (iconType === 'building' && buildingConfig[iconId]) {
            imagePath = buildingConfig[iconId].image;
        } else if (iconType === 'unit' && unitConfig[iconId]) {
            imagePath = unitConfig[iconId].image;
        }
        
        if (imagePath && images[imagePath]) {
            setIconSrc(images[imagePath]);
        }
    }, [iconType, iconId]);

    // Set a timer to automatically close the notification.
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, 5500); // This duration should match the CSS animation timings

        return () => clearTimeout(timer);
    }, [id, onClose]);

    return (
        <div className="notification-wrapper">
            <div className="notification-container">
                <div className="notification-icon-wrapper">
                    {iconSrc && <img src={iconSrc} alt="icon" className="notification-icon" />}
                </div>
                <div className="notification-content">
                    <p className="notification-message">{message}</p>
                </div>
                <div className="notification-progress-bar"></div>
            </div>
        </div>
    );
};

export default Notification;
