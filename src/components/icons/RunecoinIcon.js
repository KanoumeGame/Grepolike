// src/components/icons/RunecoinIcon.js
import React from 'react';

const RunecoinIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
    {...props}
  >
    <defs>
      <linearGradient id="runecoinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#fde047', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#eab308', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <path
      fillRule="evenodd"
      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM8.281 9.43a.75.75 0 01.918-.415l4.5 2.25a.75.75 0 010 1.37l-4.5 2.25a.75.75 0 01-1.137-.918L9.19 12l-1.128-2.652zM15 12a.75.75 0 01-.75.75h-3a.75.75 0 010-1.5h3a.75.75 0 01.75.75z"
      clipRule="evenodd"
      fill="url(#runecoinGradient)"
    />
  </svg>
);

export default RunecoinIcon;
