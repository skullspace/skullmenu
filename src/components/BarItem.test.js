import { render } from '@testing-library/react';

import BarItem from './BarItem';

const renderItem = (props) =>
    render(<BarItem {...props} />).container.textContent;

describe('the posted price is the price the register charges', () => {
    // P2-30: the board used to post `selfcheck_price` (pos_items.self_pricing) whenever alcohol
    // was off -- which, with the bar shut, is every non-spirit row on screen. Nothing in the POS
    // or in any function reads that attribute, so an operator setting a kiosk price there had no
    // reason to expect the room-facing board to start advertising it.
    test('a self_pricing that disagrees with sale_price is not advertised', () => {
        const text = renderItem({
            name: 'Red Bull',
            price: 400,
            selfcheck_price: 300,
            category: '🚫 Non-Alcoholic'
        });

        expect(text).toContain('$4.00');
        expect(text).not.toContain('$3.00');
    });

    test('the same price is posted whether or not the bar is open', () => {
        const item = {
            name: 'Red Bull',
            price: 400,
            selfcheck_price: 300,
            category: '🚫 Non-Alcoholic'
        };

        expect(renderItem({ ...item, alcoholEnabled: true })).toContain(
            '$4.00'
        );
        expect(renderItem({ ...item, alcoholEnabled: false })).toContain(
            '$4.00'
        );
        expect(renderItem({ ...item, alcoholEnabled: false })).not.toContain(
            '$3.00'
        );
    });
});

describe('the price stack survives a category rename', () => {
    const rye = { name: 'Rye', price: 900, dbl_price: 1600 };

    // P2-31: `category === '🥃 Mixed Drinks/Shots'` meant any rename silently dropped the Double
    // line -- no error, just a board that stopped quoting the double price.
    test('spirits show Single and Double under the live category name', () => {
        const text = renderItem({ ...rye, category: '🥃 Mixed Drinks/Shots' });

        expect(text).toContain('Single');
        expect(text).toContain('$9.00');
        expect(text).toContain('Double');
        expect(text).toContain('$16.00');
    });

    test('they still do after the category is renamed', () => {
        const text = renderItem({ ...rye, category: '🍸 Mixed Drinks' });

        expect(text).toContain('Double');
        expect(text).toContain('$16.00');
    });

    test('food keeps its slice labels, not the spirits labels', () => {
        const text = renderItem({
            name: 'Pizza',
            price: 300,
            dbl_price: 500,
            category: '🍕 Food',
            size: 355
        });

        expect(text).toContain('1 Slice');
        expect(text).toContain('$3.00');
        expect(text).toContain('2 Slices');
        expect(text).toContain('$5.00');
        expect(text).not.toContain('Single');
        // a mL size on a slice of pizza is noise, and that suppression is keyed on the same
        // category match
        expect(text).not.toContain('355');
    });

    test('a category with no stack posts one plain price', () => {
        const text = renderItem({
            name: 'Tallboy',
            price: 700,
            dbl_price: 1300,
            category: '🍺 Canned Alcohol'
        });

        expect(text).toContain('$7.00');
        expect(text).not.toContain('Double');
        expect(text).not.toContain('$13.00');
    });
});
