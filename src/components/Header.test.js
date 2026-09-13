import { barStatusLabel } from './Header';

describe('barStatusLabel', () => {
    test('open shows the close time', () => {
        expect(
            barStatusLabel({
                alcoholEnabled: true,
                activeEventUnavailable: false,
                barCloseTime: '02:00'
            })
        ).toBe('Bar Open · Until 2:00 AM');
    });

    test('a genuinely closed bar says closed', () => {
        expect(
            barStatusLabel({
                alcoholEnabled: false,
                activeEventUnavailable: false,
                barCloseTime: null
            })
        ).toBe('Bar Closed');
    });

    // P0-3: a broken active-event lookup used to render an identical, confident "Bar Closed".
    test('a broken alcohol gate is NOT reported as a closed bar', () => {
        const label = barStatusLabel({
            alcoholEnabled: false,
            activeEventUnavailable: true,
            barCloseTime: null
        });
        expect(label).not.toBe('Bar Closed');
        expect(label).toMatch(/unavailable/i);
    });

    // P1-30: the gate accepts a colon-less "0200", so the header must too -- it used to print
    // "Bar Open · Until " with a blank time for exactly the events that were open.
    test('a colon-less close time is formatted, not dropped', () => {
        expect(
            barStatusLabel({
                alcoholEnabled: true,
                activeEventUnavailable: false,
                barCloseTime: '0200'
            })
        ).toBe('Bar Open · Until 2:00 AM');
    });

    test('an unparseable close time does not render a dangling "Until"', () => {
        expect(
            barStatusLabel({
                alcoholEnabled: true,
                activeEventUnavailable: false,
                barCloseTime: 'later'
            })
        ).toBe('Bar Open');
    });

    // The header reads its closing time the same way the alcohol gate reads its window: the
    // instant first, the legacy wall clock only when the row has no instant. Until this moved,
    // the header was the last reader of `barCloseTime` on this board, so dropping the legacy
    // fields would have silently blanked the time on an otherwise fully-migrated row.
    describe('migrated rows', () => {
        // Built from local parts so the expectation holds in any CI timezone -- the board renders
        // the instant in the device's clock, which at the venue IS the venue's.
        const localInstant = (h, m) => new Date(2026, 8, 27, h, m, 0, 0).toISOString();

        test('prefers the barClosesAt instant over the legacy string', () => {
            expect(
                barStatusLabel({
                    alcoholEnabled: true,
                    activeEventUnavailable: false,
                    barCloseTime: '23:00', // stale/divergent on purpose
                    barClosesAt: localInstant(2, 0)
                })
            ).toBe('Bar Open · Until 2:00 AM');
        });

        test('falls back to the legacy string when the row has no instant', () => {
            expect(
                barStatusLabel({
                    alcoholEnabled: true,
                    activeEventUnavailable: false,
                    barCloseTime: '02:00',
                    barClosesAt: null
                })
            ).toBe('Bar Open · Until 2:00 AM');
        });

        // "1800" is a YEAR to Date.parse, not a time -- parseInstant rejects it precisely so a
        // wall clock can never be mistaken for an instant and printed as midnight.
        test('a wall clock in the instant field falls back instead of printing midnight', () => {
            expect(
                barStatusLabel({
                    alcoholEnabled: true,
                    activeEventUnavailable: false,
                    barCloseTime: '02:00',
                    barClosesAt: '1800'
                })
            ).toBe('Bar Open · Until 2:00 AM');
        });
    });
});
