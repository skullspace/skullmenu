import { parseTimeToMinutes } from '../utils/barHours';

// Formats an event's barCloseTime as "2:00 AM". Parsed by the SAME parser the alcohol gate uses,
// so the header can never fall back to a blank time for a window the gate considers valid -- an
// event saved as "0200" rather than "02:00" opens the bar either way (P1-30).
function formatTime(value) {
    const minutes = parseTimeToMinutes(value);
    if (minutes === null) return '';
    const hour24 = Math.floor(minutes / 60);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let display = hour24 % 12;
    if (display === 0) display = 12;
    return `${display}:${String(minutes % 60).padStart(2, '0')} ${period}`;
}

// The three states the header can be in, kept apart on purpose. "Bar Closed" is a statement about
// the bar; `unavailable` is a statement about us -- we could not reach the active-event lookup, so
// alcohol is hidden without anyone actually having closed the bar. Collapsing the second into the
// first is what left staff and customers reading a confident "Bar Closed" off a broken gate.
export function barStatusLabel({ alcoholEnabled, activeEventUnavailable, barCloseTime }) {
    if (alcoholEnabled) {
        const until = formatTime(barCloseTime);
        return until ? `Bar Open · Until ${until}` : 'Bar Open';
    }
    if (activeEventUnavailable) return 'Bar Status Unavailable · Ask Staff';
    return 'Bar Closed';
}

export default function Header({
    alcoholEnabled,
    barCloseTime,
    activeEventUnavailable = false
}) {
    const state = alcoholEnabled
        ? 'open'
        : activeEventUnavailable
          ? 'unavailable'
          : 'closed';
    return (
        <header className="bar-topbar">
            <div className="bar-logo-wrap">
                <img
                    className="bar-logo"
                    src="skullspace_dark.svg"
                    alt="SkullSpace logo"
                />
            </div>
            <div className={`bar-status ${state}`} role="status">
                <span className="bar-status-dot" />
                {barStatusLabel({
                    alcoholEnabled,
                    activeEventUnavailable,
                    barCloseTime
                })}
            </div>
        </header>
    );
}
