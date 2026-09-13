import { barStatusLabel } from './Header';

// Built from local parts so the expectation holds in any CI timezone -- the board renders the
// instant in the device's clock, which at the venue IS the venue's.
const localInstant = (h, m) => new Date(2026, 8, 27, h, m, 0, 0).toISOString();

describe('barStatusLabel', () => {
    test('open shows the close time', () => {
        expect(
            barStatusLabel({
                alcoholEnabled: true,
                activeEventUnavailable: false,
                barClosesAt: localInstant(2, 0)
            })
        ).toBe('Bar Open · Until 2:00 AM');
    });

    test('a genuinely closed bar says closed', () => {
        expect(
            barStatusLabel({
                alcoholEnabled: false,
                activeEventUnavailable: false,
                barClosesAt: null
            })
        ).toBe('Bar Closed');
    });

    // P0-3: a broken active-event lookup used to render an identical, confident "Bar Closed".
    test('a broken alcohol gate is NOT reported as a closed bar', () => {
        const label = barStatusLabel({
            alcoholEnabled: false,
            activeEventUnavailable: true,
            barClosesAt: null
        });
        expect(label).not.toBe('Bar Closed');
        expect(label).toMatch(/unavailable/i);
    });

    test('an unreadable close time does not render a dangling "Until"', () => {
        expect(
            barStatusLabel({
                alcoholEnabled: true,
                activeEventUnavailable: false,
                barClosesAt: 'later'
            })
        ).toBe('Bar Open');
    });

    test('a row with no close instant at all says only "Bar Open"', () => {
        expect(
            barStatusLabel({
                alcoholEnabled: true,
                activeEventUnavailable: false,
                barClosesAt: null
            })
        ).toBe('Bar Open');
    });

    // The header reads its closing time from `barClosesAt` and nothing else. It was the last
    // reader of the retired `barCloseTime` wall clock on this board, and that fallback is gone for
    // the same reason the gate's is: the wall clock is what let this board and the register read
    // one stored row two different ways.
    describe('the retired wall clock is not consulted', () => {
        test('a leftover barCloseTime on the row is ignored, not preferred', () => {
            // The state of a row between this build reaching the TVs and the attribute being
            // dropped from the schema: the string is still there, and stale on purpose.
            expect(
                barStatusLabel({
                    alcoholEnabled: true,
                    activeEventUnavailable: false,
                    barCloseTime: '23:00',
                    barClosesAt: localInstant(2, 0)
                })
            ).toBe('Bar Open · Until 2:00 AM');
        });

        test('a leftover barCloseTime cannot supply a time the instant does not', () => {
            // This is the assertion that changed with the migration. The header used to fall back
            // here and print "Until 2:00 AM" off the wall clock; it now prints no time at all,
            // which matches the gate -- a row in this shape has no window, so the alcohol columns
            // beside the header are hidden and naming a closing hour would contradict them.
            expect(
                barStatusLabel({
                    alcoholEnabled: true,
                    activeEventUnavailable: false,
                    barCloseTime: '02:00',
                    barClosesAt: null
                })
            ).toBe('Bar Open');
        });

        // "1800" is a YEAR to Date.parse, not a time -- parseInstant rejects it precisely so a
        // wall clock can never be mistaken for an instant and printed as midnight.
        test('a wall clock in the instant field prints nothing, never midnight', () => {
            const label = barStatusLabel({
                alcoholEnabled: true,
                activeEventUnavailable: false,
                barClosesAt: '1800'
            });
            expect(label).toBe('Bar Open');
            expect(label).not.toMatch(/12:00 AM/);
        });
    });
});
