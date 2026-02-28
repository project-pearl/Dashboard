'use client';

import React from 'react';

interface PearlIconProps {
  size?: number;
  className?: string;
}

export function PearlIcon({ size = 20, className = '' }: PearlIconProps) {
  const id = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="PIN AI"
    >
      <title>Powered by PIN AI</title>
      <defs>
        <radialGradient id={`pearl-grad-${id}`} cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#dbeafe" />
          <stop offset="80%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </radialGradient>
        <radialGradient id={`pearl-shimmer-${id}`} cx="30%" cy="25%" r="35%">
          <stop offset="0%" stopColor="#fbcfe8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fbcfe8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill={`url(#pearl-grad-${id})`} stroke="#bfdbfe" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="10" fill={`url(#pearl-shimmer-${id})`} />
      <ellipse cx="9" cy="8.5" rx="3.5" ry="2" fill="white" opacity="0.55" transform="rotate(-20 9 8.5)" />
    </svg>
  );
}
