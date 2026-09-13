import { parseInstant, parseTimeToMinutes } from '../utils/barHours';

// Renders "2:00 AM" from minutes-past-midnight.
function formatMinutes(minutes) {
    const hour24 = Math.floor(minutes / 60);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let display = hour24 % 12;
    if (display === 0) display = 12;
    return `${display}:${String(minutes % 60).padStart(2, '0')} ${period}`;
}

// The closing time to print, read the same way the alcohol gate reads its window: the
// `barClosesAt` instant when the row carries one, the legacy `barCloseTime` wall clock otherwise.
//
// Both come from the SAME source the gate used to decide the bar is open, so the header can never
// print a time the gate disagrees with -- including the "0200" form an admin could type into the
// old unvalidated field, which this board accepts and the register does not (P1-30).
//
// The instant is rendered in the DEVICE's clock, which is the venue's: this board hangs on the
// wall at Skullspace, and `isWithinBarHours` already compares against that same local clock.
function formatCloseTime({ barClosesAt, barCloseTime }) {
    const ms = parseInstant(barClosesAt);
    if (ms !== null) {
        const at = new Date(ms);
        return formatMinutes(at.getHours() * 60 + at.getMinutes());
    }
    const minutes = parseTimeToMinutes(barCloseTime);
    return minutes === null ? '' : formatMinutes(minutes);
}

// The three states the header can be in, kept apart on purpose. "Bar Closed" is a statement about
// the bar; `unavailable` is a statement about us -- we could not reach the active-event lookup, so
// alcohol is hidden without anyone actually having closed the bar. Collapsing the second into the
// first is what left staff and customers reading a confident "Bar Closed" off a broken gate.
export function barStatusLabel({
    alcoholEnabled,
    activeEventUnavailable,
    barCloseTime,
    barClosesAt
}) {
    if (alcoholEnabled) {
        const until = formatCloseTime({ barClosesAt, barCloseTime });
        return until ? `Bar Open · Until ${until}` : 'Bar Open';
    }
    if (activeEventUnavailable) return 'Bar Status Unavailable · Ask Staff';
    return 'Bar Closed';
}

export default function Header({
    alcoholEnabled,
    barCloseTime,
    barClosesAt,
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
                    barCloseTime,
                    barClosesAt
                })}
            </div>
        </header>
    );
}
