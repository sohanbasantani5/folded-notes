import React from 'react';
import { motion } from 'motion/react';

interface MascotBadgeProps {
  customMascotUrl: string | null;
  celebrating?: boolean;
  size?: number;
}

export const MascotBadge: React.FC<MascotBadgeProps> = ({
  customMascotUrl,
  celebrating = false,
  size = 44,
}) => {
  return (
    <motion.div
      animate={
        celebrating
          ? {
              y: [0, -8, 0, -4, 0],
              rotate: [0, -6, 6, -3, 0],
              scale: [1, 1.08, 1],
            }
          : {
              y: [0, -2.5, 0],
            }
      }
      transition={
        celebrating
          ? { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
          : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
      }
      style={{ width: size, height: size }}
      className="relative flex shrink-0 items-center justify-center select-none"
      aria-hidden="true"
    >
      {customMascotUrl ? (
        <img
          src={customMascotUrl}
          alt="folded notes mascot"
          style={{ width: size, height: size }}
          className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.12)]"
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.10)]"
        >
          <defs>
            <radialGradient id="mintBody" cx="38%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#B8F5E5" />
              <stop offset="55%" stopColor="#8CE2CC" />
              <stop offset="100%" stopColor="#6EC7B1" />
            </radialGradient>
            <linearGradient id="mintFold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D6FAF0" />
              <stop offset="100%" stopColor="#9EEAD7" />
            </linearGradient>
          </defs>

          {/* Left waving arm */}
          <ellipse
            cx="12.5"
            cy="31"
            rx="5.5"
            ry="3.8"
            transform="rotate(-32 12.5 31)"
            fill="#86DEC8"
          />

          {/* Right arm */}
          <ellipse
            cx="51.5"
            cy="36"
            rx="5.2"
            ry="3.6"
            transform="rotate(24 51.5 36)"
            fill="#7AD2BC"
          />

          {/* Feet */}
          <rect x="21" y="48" width="7.5" height="8" rx="3.75" fill="#76CEB8" />
          <rect x="35.5" y="48" width="7.5" height="8" rx="3.75" fill="#76CEB8" />

          {/* Main rounded body with clipped top-right corner */}
          <path
            d="M 32 11 C 20.5 11 14 18.5 14 31 C 14 43.5 21 51 32 51 C 43 51 50 43.5 50 31 C 50 26.8 49.3 23.2 48 20.3 L 38.7 11.7 C 36.6 11.2 34.4 11 32 11 Z"
            fill="url(#mintBody)"
          />

          {/* Signature folded paper ear on top-right */}
          <path
            d="M 38.5 11.6 C 38.5 16.5 41.2 20.5 48.1 20.4 C 45.4 16.3 42.3 13.4 38.5 11.6 Z"
            fill="url(#mintFold)"
          />

          {/* Soft rosy cheeks */}
          <ellipse cx="22.5" cy="36.5" rx="3.6" ry="2.1" fill="#F29C9C" fillOpacity="0.45" />
          <ellipse cx="41.5" cy="36.5" rx="3.6" ry="2.1" fill="#F29C9C" fillOpacity="0.45" />

          {/* Sparkly dark eyes */}
          <circle cx="25.5" cy="31.5" r="3.4" fill="#2A2630" />
          <circle cx="24.4" cy="30.3" r="1.15" fill="#FFFFFF" />
          <circle cx="26.7" cy="32.5" r="0.55" fill="#FFFFFF" />

          <circle cx="38.5" cy="31.5" r="3.4" fill="#2A2630" />
          <circle cx="37.4" cy="30.3" r="1.15" fill="#FFFFFF" />
          <circle cx="39.7" cy="32.5" r="0.55" fill="#FFFFFF" />

          {/* Happy smile */}
          <path
            d="M 29.2 35.8 C 29.2 37.9 34.8 37.9 34.8 35.8"
            stroke="#2A2630"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      )}
    </motion.div>
  );
};