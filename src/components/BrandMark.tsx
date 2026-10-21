import { useId } from 'react';

export const BrandMark = () => {
  const id = useId();
  return (
    <span className="brand-glass" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <defs>
          <mask id={`${id}-mark`} maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
            <circle cx="16" cy="22" r="10" stroke="white" strokeWidth="5" />
            <path d="M26 12v20" stroke="white" strokeWidth="5" strokeLinecap="round" />
            <circle cx="35" cy="32" r="2.5" fill="white" />
          </mask>
          <radialGradient id={`${id}-wave`}>
            <stop offset="0.28" stopColor="#8d6869" stopOpacity="0" />
            <stop offset="0.33" stopColor="#8d6869" />
            <stop offset="0.38" stopColor="#5a8ea6" />
            <stop offset="0.43" stopColor="#b9c96e" />
            <stop offset="0.48" stopColor="#c7c571" />
            <stop offset="0.53" stopColor="#cb706f" />
            <stop offset="0.58" stopColor="#7e5e5f" />
            <stop offset="0.65" stopColor="#7e5e5f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g mask={`url(#${id}-mark)`}>
          <path fill="currentColor" d="M0 0h40v40H0z" />
          <circle className="brand-wave" cx="20" cy="40" r="48" fill={`url(#${id}-wave)`} />
        </g>
      </svg>
    </span>
  );
};
