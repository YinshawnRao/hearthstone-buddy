import type { Expression } from '../../../shared/bubble';

/** Original illustration for 澄. Not a Blizzard character and not a Live2D model. */
export function Cheng({ expression, lowMotion }: { expression: Expression; lowMotion: boolean }) {
  const worried = expression === 'uncertain' || expression === 'error';
  const talking = expression === 'advice' || expression === 'encouragement' || expression === 'thinking';
  return (
    <svg
      className={lowMotion ? 'cheng reduce' : 'cheng'}
      data-expression={expression}
      viewBox="0 0 360 520"
      role="img"
      aria-label="澄"
    >
      <g className="cheng-breath">
        <path d="M70 250c10 90 30 170 40 210h150c8-40 28-120 36-210-30 24-70 36-110 36s-86-14-116-36z" fill="#f2d7c4" />
        <path d="M78 300c20 70 40 150 48 190h120c6-40 24-110 40-190-24 18-58 28-104 28s-78-10-104-28z" fill="#6e3b4a" />
        <path d="M118 318c18 8 40 12 62 12s44-4 62-12c-8 28-28 70-62 78-34-8-54-50-62-78z" fill="#f6e2d4" />
        <path d="M150 250h60c8 20 8 40 0 58h-60c-8-18-8-38 0-58z" fill="#f3c7b0" />
        <path d="M40 210c20-20 70-40 140-40s120 20 140 46c-10 80-40 150-70 190-20-40-40-70-70-78-34 10-58 42-78 84-28-40-52-100-62-202z" fill="#2a1c24" />
        <path d="M78 120c18-48 70-78 120-70 34 6 62 28 74 58 8 40-8 70-20 92-18-30-48-48-86-48-28 0-58 12-78 36-8-24-16-46-10-68z" fill="#4a2c33" />
        <ellipse cx="180" cy="168" rx="62" ry="70" fill="#f6d2c0" />
        <path d="M118 150c8-36 40-62 74-58 28 4 50 24 58 48-20 10-36 8-52-2-18 16-40 20-64 12-8-10-14-8-16 0z" fill="#3a2228" />
        <path d="M126 188c16 10 28 8 40-2 8 12 22 16 36 10 2 16-8 28-24 34-22 8-42 2-52-14-6-10-6-20 0-28z" fill="#f6d2c0" />
        <ellipse cx="156" cy="186" rx="10" ry="6" fill="#e7a090" opacity="0.55" />
        <ellipse cx="214" cy="186" rx="10" ry="6" fill="#e7a090" opacity="0.55" />
        <g className="cheng-eyes">
          <ellipse cx="156" cy="176" rx="8" ry={worried ? 6 : 9} fill="#2a211c" />
          <ellipse cx="210" cy="176" rx="8" ry={worried ? 6 : 9} fill="#2a211c" />
          <circle cx="158" cy="174" r="2.2" fill="#fff8ee" />
          <circle cx="212" cy="174" r="2.2" fill="#fff8ee" />
        </g>
        <path className="cheng-eyes-closed" d="M146 176c6 6 14 6 20 0M200 176c6 6 14 6 20 0" fill="none" stroke="#6a4038" strokeWidth="3" strokeLinecap="round" />
        <path d={worried ? 'M148 156c8-8 18-6 24 2M196 158c8-8 18-4 22 4' : 'M148 158c8-6 18-6 24 0M198 158c8-6 16-6 22 0'} fill="none" stroke="#6a4038" strokeWidth="3" strokeLinecap="round" />
        <path d={talking ? 'M168 214c8 10 18 10 26 0' : worried ? 'M170 214h22' : 'M166 210c10 12 22 12 32 0'} fill={talking ? '#c46a6a' : 'none'} stroke="#a15a52" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
