// src/components/icons/PlatinumIcon.js
import React from 'react';

const PlatinumIcon = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className="w-6 h-6"
    {...props}
  >
    <defs>
      <linearGradient id="platinumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#e5e7eb', stopOpacity: 1}} />
        <stop offset="100%" style={{stopColor: '#9ca3af', stopOpacity: 1}} />
      </linearGradient>
    </defs>
    <path 
      fillRule="evenodd" 
      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 1.5a8.25 8.25 0 100 16.5 8.25 8.25 0 000-16.5zm-3 7.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" 
      clipRule="evenodd" 
      fill="url(#platinumGradient)" 
    />
  </svg>
);

export default PlatinumIcon;
