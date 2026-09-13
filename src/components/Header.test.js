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
});
