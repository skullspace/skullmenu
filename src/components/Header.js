import React, { useEffect } from 'react';

export default function Header({ settings }) {
    const [rawStart, rawEnd] = settings
        ? [settings.bar_start, settings.bar_end]
        : [15, 2];
    const alcoholStart = Number(rawStart ?? 15);
    const alcoholEnd = Number(rawEnd ?? 2);
    const hour = new Date().getHours();
    const normHour = (h) => (((Number(h) || 0) % 24) + 24) % 24;
    const s = normHour(alcoholStart);
    const e = normHour(alcoholEnd);
    const alcoholEnabled =
        s <= e ? hour >= s && hour < e : hour >= s || hour < e;

    const [imgSrc, setImgSrc] = React.useState();

    useEffect(() => {
        // if (alcoholEnabled) {
        //     setImgSrc('skullspace_dark.svg');
        // } else {
        //     setImgSrc('skullspace_light.svg');
        // }
        setImgSrc('skullspace_dark.svg');
    }, [alcoholEnabled]);

    return (
        <header className="bar-header">
            <img className="bar-logo" src={imgSrc} alt="SkullSpace logo" />
            <h2 className="bar-subtitle">
                {alcoholEnabled ? 'Bar Menu' : 'Canteen Menu'}
            </h2>
        </header>
    );
}
