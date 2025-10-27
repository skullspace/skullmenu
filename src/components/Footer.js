import React from 'react';
import SkullSpaceMemberLogo from './SkullSpaceMemberLogo';

export default function Footer({ settings }) {
    // only show footer if alcohol is enabled
    if (!settings) return null;

    const alcoholStart = Number(settings.bar_start ?? 15);
    const alcoholEnd = Number(settings.bar_end ?? 2);
    const hour = new Date().getHours();
    const normHour = (h) => (((Number(h) || 0) % 24) + 24) % 24;
    const s = normHour(alcoholStart);
    const e = normHour(alcoholEnd);
    const alcoholEnabled =
        s <= e ? hour >= s && hour < e : hour >= s || hour < e;

    if (!alcoholEnabled) return null;

    return (
        <footer className="bar-footer">
            <em>
                <SkullSpaceMemberLogo />
                SkullSpace members receieve a{' '}
                <strong>{settings?.member_discount || 0}% discount</strong>.
            </em>
        </footer>
    );
}
