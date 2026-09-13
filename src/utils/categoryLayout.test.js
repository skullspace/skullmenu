import {
    categoryColumnTitle,
    isFoodCategory,
    isMixedDrinksCategory,
    isNonAlcoholicCategory,
    normalizeCategoryName,
    stripCategoryEmoji
} from './categoryLayout';

// The four names the live Categories collection holds today.
const MIXED = '🥃 Mixed Drinks/Shots';
const CANNED = '🍺 Canned Alcohol';
const NON_ALC = '🚫 Non-Alcoholic';
const FOOD = 'Food';

describe('the live category names still classify the way the board expects', () => {
    test('mixed drinks is the only one that takes the Single/Double stack', () => {
        expect(isMixedDrinksCategory(MIXED)).toBe(true);
        expect(isMixedDrinksCategory(CANNED)).toBe(false);
        expect(isMixedDrinksCategory(NON_ALC)).toBe(false);
        expect(isMixedDrinksCategory(FOOD)).toBe(false);
    });

    test('food is the only one that takes the slice stack', () => {
        expect(isFoodCategory(FOOD)).toBe(true);
        expect(isFoodCategory(MIXED)).toBe(false);
        expect(isFoodCategory(CANNED)).toBe(false);
    });

    test('"Alcohol" inside a name does not make it the non-alcoholic column', () => {
        expect(isNonAlcoholicCategory(NON_ALC)).toBe(true);
        expect(isNonAlcoholicCategory(CANNED)).toBe(false);
    });
});

// P2-31: these are the renames that used to turn the double price off with no error.
describe('a staff rename does not silently change the layout', () => {
    test('dropping "/Shots" keeps the double price on screen', () => {
        expect(isMixedDrinksCategory('🥃 Mixed Drinks')).toBe(true);
        expect(isMixedDrinksCategory('Mixed Drinks')).toBe(true);
        expect(isMixedDrinksCategory('🍸 Mixed Drinks & Shots')).toBe(true);
    });

    test('a changed emoji, or none at all, does not break the match', () => {
        expect(isMixedDrinksCategory('🍹 Mixed Drinks/Shots')).toBe(true);
        expect(isMixedDrinksCategory('Mixed Drinks/Shots')).toBe(true);
        expect(isFoodCategory('🍕 Food')).toBe(true);
        expect(isNonAlcoholicCategory('Non-Alcoholic')).toBe(true);
    });

    // The sharpest edge: a copy-paste that adds a variation selector renders identically.
    test('an invisible variation selector after the emoji does not break the match', () => {
        expect(isMixedDrinksCategory('\u{1F943}️ Mixed Drinks/Shots')).toBe(
            true
        );
        expect(stripCategoryEmoji('\u{1F943}️ Mixed Drinks/Shots')).toBe(
            'Mixed Drinks/Shots'
        );
    });

    test('case and stray whitespace do not break the match', () => {
        expect(isMixedDrinksCategory('  mixed  drinks/shots ')).toBe(true);
        expect(isFoodCategory(' FOOD ')).toBe(true);
        expect(isNonAlcoholicCategory('non alcoholic')).toBe(true);
    });
});

describe('the match stays narrow enough to be wrong about nothing else', () => {
    test('"Mixed" must be the leading word, not buried in the name', () => {
        expect(isMixedDrinksCategory('Premixed Cans')).toBe(false);
        expect(isMixedDrinksCategory('Cans, Mixed')).toBe(false);
    });

    test('a wider food category does not inherit the slice labels', () => {
        expect(isFoodCategory('Food & Merch')).toBe(false);
        expect(isFoodCategory('Hot Food')).toBe(false);
    });

    test('a leading digit survives the emoji strip', () => {
        expect(stripCategoryEmoji('2 for 1')).toBe('2 for 1');
        expect(normalizeCategoryName('2 for 1')).toBe('2 FOR 1');
    });

    test('a non-string name classifies as nothing rather than throwing', () => {
        expect(stripCategoryEmoji(undefined)).toBe('');
        expect(isMixedDrinksCategory(null)).toBe(false);
        expect(isFoodCategory(undefined)).toBe(false);
    });
});

describe('categoryColumnTitle', () => {
    test('the non-alcoholic column is just "Beverages" with the bar shut', () => {
        expect(categoryColumnTitle(NON_ALC, false)).toBe('Beverages');
    });

    test('with the bar open it keeps its own name, emoji prefix dropped', () => {
        expect(categoryColumnTitle(NON_ALC, true)).toBe('Non-Alcoholic');
    });

    test('a renamed non-alcoholic column still softens to "Beverages"', () => {
        expect(categoryColumnTitle('🥤 Non Alcoholic', false)).toBe(
            'Beverages'
        );
    });

    test('other columns keep their name whether the bar is open or not', () => {
        expect(categoryColumnTitle(MIXED, true)).toBe('Mixed Drinks/Shots');
        expect(categoryColumnTitle(MIXED, false)).toBe('Mixed Drinks/Shots');
        expect(categoryColumnTitle(FOOD, false)).toBe('Food');
    });
});
