import SkullSpaceMemberLogo from './SkullSpaceMemberLogo';

export default function Footer({ settings, alcoholEnabled }) {
    // only show the discount note while alcohol (full bar) service is on
    if (!settings || !alcoholEnabled) return null;

    return (
        <footer className="bar-footer">
            <SkullSpaceMemberLogo />
            <div className="bar-footer-text">
                SkullSpace members receive a{' '}
                <b>{settings?.member_discount || 0}% discount</b>.
            </div>
        </footer>
    );
}
