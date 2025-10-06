import React from 'react';
import SkullSpaceMemberLogo from './SkullSpaceMemberLogo';
import { useAppwrite } from '../API/api';

export default function Footer() {
    const { settings } = useAppwrite();

    return (
        <footer className="bar-footer">
            <em>
                <SkullSpaceMemberLogo />
                SkullSpace members receieve a <strong>{settings?.member_discount || 0}% discount</strong>.
            </em>
        </footer>
    )
}

