function formatHour(h) {
    const hour = (((Number(h) || 0) % 24) + 24) % 24;
    const period = hour >= 12 ? 'PM' : 'AM';
    let display = hour % 12;
    if (display === 0) display = 12;
    return `${display}:00 ${period}`;
}

export default function Header({ alcoholEnabled, barEndHour }) {
    return (
        <header className="bar-topbar">
            <div className="bar-logo-wrap">
                <img
                    className="bar-logo"
                    src="skullspace_dark.svg"
                    alt="SkullSpace logo"
                />
            </div>
            <div className={`bar-status ${alcoholEnabled ? 'open' : 'closed'}`}>
                <span className="bar-status-dot" />
                {alcoholEnabled
                    ? `Bar Open · Until ${formatHour(barEndHour)}`
                    : 'Bar Closed'}
            </div>
        </header>
    );
}
