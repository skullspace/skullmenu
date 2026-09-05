import { useMemo } from 'react';

let nextId = 0;

// A faint film-grain texture over the flat background, standing in for the
// old looping background video -- ambient, but no motion or media to load.
export default function Grain() {
    const filterId = useMemo(() => `grain-${nextId++}`, []);

    return (
        <svg className="grain" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <filter id={filterId}>
                <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.85"
                    numOctaves="2"
                    stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${filterId})`} />
        </svg>
    );
}
