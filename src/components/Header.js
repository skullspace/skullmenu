import { parseInstant } from '../utils/barHours';

// Renders "2:00 AM" from minutes-past-midnight.
function formatMinutes(minutes) {
    const hour24 = Math.floor(minutes / 60);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let display = hour24 % 12;
    if (display === 0) display = 12;
    return `${display}:${String(minutes % 60).padStart(2, '0')} ${period}`;
}

// The closing time to print, read from the SAME field the alcohol gate used to decide the bar is
// open: the `barClosesAt` instant, and nothing else. The header used to fall back to the legacy
// `barCloseTime` wall clock, which is now retired -- it was the last reader of that field on this
// board, and it is gone for the same reason the gate's own fallback is: a wall clock is what let
// this board and the register read one stored row two different ways (P1-30).
//
// The instant is rendered in the DEVICE's clock, which is the venue's: this board hangs on the
// wall at Skullspace, and `isWithinBarHours` compares against that same local clock.
//
// An unreadable instant prints nothing rather than a wrong time. That is not a lost fallback: the
// gate treats the same value as "no window" and hides alcohol, so a header that still named a
// closing hour would be contradicting the columns underneath it.
function formatCloseTime(barClosesAt) {
    const ms = parseInstant(barClosesAt);
    if (ms === null) return '';
    const at = new Date(ms);
    return formatMinutes(at.getHours() * 60 + at.getMinutes());
}

// The three states the header can be in, kept apart on purpose. "Bar Closed" is a statement about
// the bar; `unavailable` is a statement about us -- we could not reach the active-event lookup, so
// alcohol is hidden without anyone actually having closed the bar. Collapsing the second into the
// first is what left staff and customers reading a confident "Bar Closed" off a broken gate.
export function barStatusLabel({
    alcoholEnabled,
    activeEventUnavailable,
    barClosesAt
}) {
    if (alcoholEnabled) {
        const until = formatCloseTime(barClosesAt);
        return until ? `Bar Open · Until ${until}` : 'Bar Open';
    }
    if (activeEventUnavailable) return 'Bar Status Unavailable · Ask Staff';
    return 'Bar Closed';
}

export default function Header({
    alcoholEnabled,
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
                    barClosesAt
                })}
            </div>
        </header>
    );
}
