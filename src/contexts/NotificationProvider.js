/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
import React, { useState, useCallback, useRef } from 'react';
import NotificationContext from './NotificationContext';
import Notification from '../components/shared/Notification';
import { v4 as uuidv4 } from 'uuid';

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const recentNotifications = useRef(new Set());

    const addNotification = useCallback((message, iconType, iconId) => {
        if (recentNotifications.current.has(message)) {
            return;
        }

        const id = uuidv4();
        setNotifications(prev => [...prev, { id, message, iconType, iconId }]);
        recentNotifications.current.add(message);

        setTimeout(() => {
            recentNotifications.current.delete(message);
        }, 2000);
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ addNotification }}>
            {children}
            <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-end">
                {notifications.map(notification => (
                    <Notification
                        key={notification.id}
                        id={notification.id}
                        message={notification.message}
                        iconType={notification.iconType}
                        iconId={notification.iconId}
                        onClose={removeNotification}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
};
