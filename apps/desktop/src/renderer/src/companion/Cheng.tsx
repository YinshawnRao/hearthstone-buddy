import type { Expression } from '../../../shared/bubble';

/**
 * Original bust of 澄, drawn in SVG for this project.
 * Not a Blizzard character, not scraped fan art, and not a Live2D or commissioned model.
 */
export function Cheng({ expression, lowMotion }: { expression: Expression; lowMotion: boolean }) {
  const worried = expression === 'uncertain' || expression === 'error';
  const talking = expression === 'advice' || expression === 'encouragement' || expression === 'thinking';
  const smile = expression === 'advice' || expression === 'encouragement' || expression === 'idle';
  return (
    <svg className={lowMotion ? 'cheng reduce' : 'cheng'} data-expression={expression} viewBox="0 0 420 700" role="img" aria-label="澄">
      <defs>
        <linearGradient id="cheng-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6a3144" />
          <stop offset="0.45" stopColor="#3a1b28" />
          <stop offset="1" stopColor="#241018" />
        </linearGradient>
        <linearGradient id="cheng-hair-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e7b3c0" />
          <stop offset="1" stopColor="#a15a6c" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cheng-skin" cx="42%" cy="36%" r="70%">
          <stop offset="0" stopColor="#ffe0cf" />
          <stop offset="0.55" stopColor="#f3c2aa" />
          <stop offset="1" stopColor="#e0a48e" />
        </radialGradient>
        <linearGradient id="cheng-vest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d3d4e" />
          <stop offset="1" stopColor="#4d2030" />
        </linearGradient>
        <linearGradient id="cheng-cape" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5c2a3a" />
          <stop offset="1" stopColor="#241018" />
        </linearGradient>
        <radialGradient id="cheng-iris" cx="35%" cy="35%" r="70%">
          <stop offset="0" stopColor="#f2d7a4" />
          <stop offset="0.45" stopColor="#c47a3a" />
          <stop offset="1" stopColor="#6a3418" />
        </radialGradient>
      </defs>
      <g className="cheng-breath">
        <path d="M40 250c30-20 70-30 110-20 10 80 18 180 8 300H70C50 430 36 340 40 250z" fill="url(#cheng-cape)" />
        <path d="M380 250c-30-20-70-30-110-20-10 80-18 180-8 300h88c20-100 34-190 30-280z" fill="url(#cheng-cape)" />
        <path d="M78 300c18 40 40 120 48 210h168c8-90 30-170 48-210-40 36-80 52-132 52s-92-16-132-52z" fill="#f4e4d4" />
        <path d="M108 330c22 16 48 24 102 24s80-8 102-24c-8 50-30 130-48 176H156c-18-46-40-126-48-176z" fill="url(#cheng-vest)" />
        <path d="M168 348h84l-8 150h-68z" fill="#f7efe4" />
        <path d="M186 360h48v120h-48z" fill="#f3d7c4" />
        <path d="M196 392h28" stroke="#e7c98a" strokeWidth="3" />
        <path d="M196 412h28" stroke="#e7c98a" strokeWidth="3" />
        <circle cx="210" cy="372" r="7" fill="#e7c98a" />
        <path d="M150 250c8 28 24 48 60 52 36-4 52-24 60-52-16 10-36 16-60 16s-44-6-60-16z" fill="#f3c7b0" />
        <path d="M92 168c8 70 28 130 48 168 8-40 20-78 36-100-30-10-62-28-84-68z" fill="url(#cheng-hair)" />
        <path d="M328 168c-8 70-28 130-48 168-8-40-20-78-36-100 30-10 62-28 84-68z" fill="url(#cheng-hair)" />
        <path d="M70 150c24-78 90-120 150-112 62 8 112 52 128 112 8 70-18 120-36 160-28-46-62-74-104-78-40 6-74 34-102 80-16-42-42-92-36-162z" fill="url(#cheng-hair)" />
        <path d="M118 96c28-28 70-40 108-34 8 18 6 36-8 48-28-8-62-6-90 8-12-8-16-14-10-22z" fill="url(#cheng-hair-light)" opacity="0.85" />
        <path d="M250 110c30 8 48 28 58 52-16 4-28-2-40-16-8-16-14-28-18-36z" fill="#d7a0ae" opacity="0.55" />
        <path d="M126 188c6-8 20-18 36-16 10 16 4 28-8 34-16 4-28-4-28-18z" fill="url(#cheng-hair)" />
        <path d="M258 172c16 2 28 12 34 28 2 10-8 16-16 12-12-8-20-22-18-40z" fill="url(#cheng-hair)" />
        <path d="M148 188c2-52 28-84 62-86 36-2 64 28 68 78 4 46-8 92-28 118-14 16-30 24-40 26-12-2-28-12-42-30-22-28-24-70-20-106z" fill="url(#cheng-skin)" />
        <path d="M150 196c18-46 48-70 78-66 32 4 58 28 70 62-22 8-40 6-58-4-16 14-36 20-58 16-14-8-24-6-32-8z" fill="#3a1c28" />
        <path d="M146 230c22-16 40-18 58-6 4 10-6 16-16 14-12-2-24-2-34 4-6-4-10-8-8-12z" fill="#4a2432" opacity="0.35" />
        <ellipse cx="176" cy="236" rx="14" ry="7" fill="#e8a090" opacity="0.45" />
        <ellipse cx="248" cy="236" rx="14" ry="7" fill="#e8a090" opacity="0.45" />
        <g className="cheng-eyes" transform={expression === 'thinking' ? 'translate(0,-3)' : undefined}>
          <path d="M158 226c6-16 28-18 38-4 4 12-2 22-14 24-14 2-26-6-24-20z" fill="#fffaf6" />
          <path d="M226 222c8-16 30-16 38 0 4 14-4 24-16 26-16 2-26-6-22-26z" fill="#fffaf6" />
          <ellipse cx="176" cy="230" rx="9" ry="11" fill="url(#cheng-iris)" />
          <ellipse cx="246" cy="228" rx="9" ry="11" fill="url(#cheng-iris)" />
          <ellipse cx="178" cy="232" rx="3.4" ry="4.6" fill="#24140e" />
          <ellipse cx="248" cy="232" rx="3.4" ry="4.6" fill="#24140e" />
          <circle cx="181" cy="226" r="2.4" fill="#fff" />
          <circle cx="251" cy="226" r="2.4" fill="#fff" />
          <path d="M160 214c10-10 24-12 34-4" fill="none" stroke="#6a4038" strokeWidth="3" strokeLinecap="round" />
          <path d="M232 210c10-8 24-6 32 4" fill="none" stroke="#6a4038" strokeWidth="3" strokeLinecap="round" />
        </g>
        <path className="cheng-eyes-closed" d="M162 230c10 8 22 8 32 0M230 230c10 8 22 8 32 0" fill="none" stroke="#8a5048" strokeWidth="3" strokeLinecap="round" />
        <path d="M204 252c2 8 4 12 6 16" fill="none" stroke="#e0b09a" strokeWidth="2" strokeLinecap="round" />
        <path
          d={talking ? 'M190 286c8 16 28 18 40 2' : worried ? 'M192 292c8 4 24 4 34-2' : smile ? 'M186 284c12 16 32 16 46 0' : 'M194 288h28'}
          fill={talking ? '#c45b62' : 'none'}
          stroke="#a14d52"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M118 214c-8 36-4 78 16 104" fill="none" stroke="#d7a0ae" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
        <path d="M300 206c10 34 8 74-8 108" fill="none" stroke="#f0c8d0" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      </g>
    </svg>
  );
}
