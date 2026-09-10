// Formats an event's "HH:mm" barCloseTime (e.g. "02:00") as "2:00 AM".
function formatTime(hhmm) {
    const match = typeof hhmm === 'string' && hhmm.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '';
    const hour24 = Number(match[1]);
    const minutes = match[2];
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let display = hour24 % 12;
    if (display === 0) display = 12;
    return `${display}:${minutes} ${period}`;
}

export default function Header({ alcoholEnabled, barCloseTime }) {
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
                    ? `Bar Open · Until ${formatTime(barCloseTime)}`
                    : 'Bar Closed'}
            </div>
        </header>
    );
}
