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
          <radialGradient id={`${id}-pearl`}>
            <stop stopColor="#bdadf4" />
            <stop offset=".45" stopColor="#84bdcc" stopOpacity=".9" />
            <stop offset="1" stopColor="#84bdcc" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-warm`}>
            <stop stopColor="#f0c6aa" />
            <stop offset=".5" stopColor="#d9b4cc" stopOpacity=".8" />
            <stop offset="1" stopColor="#d9b4cc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g mask={`url(#${id}-mark)`}>
          <path fill="currentColor" d="M0 0h40v40H0z" />
          <g className="brand-flow"><ellipse cx="10" cy="13" rx="23" ry="16" fill={`url(#${id}-pearl)`} /></g>
          <g className="brand-flow brand-flow-warm"><ellipse cx="29" cy="28" rx="20" ry="15" fill={`url(#${id}-warm)`} /></g>
        </g>
      </svg>
    </span>
  );
};
