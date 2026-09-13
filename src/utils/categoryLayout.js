/**
 * categoryLayout.js -- one place that decides how a category is laid out on the board.
 *
 * P2-31: the layout used to be keyed on exact, emoji-prefixed category names --
 * `category === '🥃 Mixed Drinks/Shots'` in BarItem and `section.name === '🚫 Non-Alcoholic'` in
 * App. The `Categories` collection is writable by the staff team, so renaming "🥃 Mixed
 * Drinks/Shots" to "🥃 Mixed Drinks" silently turned the Single/Double price stack off for all six
 * spirits -- no error, just a board that stops quoting the double price the register charges. The
 * emoji is the sharper edge: a copy-paste that adds or drops a variation selector (U+FE0F), a ZWJ
 * or a skin-tone modifier changes the string while looking identical on screen.
 *
 * So the match is made on a normalised name: leading pictographs and their modifiers stripped,
 * whitespace collapsed, case folded, and the distinguishing word matched rather than the whole
 * label. That is still a name match -- the durable fix is a structured `price_stack` flag on the
 * category alongside the existing `alcohol` boolean -- but it survives every rename that keeps the
 * category recognisable to a human.
 */

/**
 * One or more leading pictographs, each with any variation selectors, ZWJs and skin-tone
 * modifiers that belong to it, plus the space after them.
 *
 * Deliberately NOT \p{Emoji}/\p{Emoji_Component}: those match ASCII digits and `#`/`*`, which
 * would eat the "2" out of a category called "2 for 1".
 */
const LEADING_PICTOGRAPHS =
    /^(?:\p{Extended_Pictographic}[︀-️‍\u{1F3FB}-\u{1F3FF}]*)+\s*/u;

/** The category name as it should read on screen: the emoji prefix dropped, nothing else. */
export function stripCategoryEmoji(name) {
    if (typeof name !== 'string') return '';
    return name.replace(LEADING_PICTOGRAPHS, '').trim();
}

/** The form the layout rules match against. */
export function normalizeCategoryName(name) {
    return stripCategoryEmoji(name).replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Spirits: the Single/Double price stack. Matched on the leading word so "Mixed Drinks/Shots",
 * "Mixed Drinks" and "Mixed" all keep their double prices.
 */
export function isMixedDrinksCategory(name) {
    return /^MIXED\b/.test(normalizeCategoryName(name));
}

/**
 * Food: the 1 Slice / 2 Slices stack, and the category whose mL size is meaningless. Matched
 * exactly (after normalising) -- widening this would relabel some future "Food & Merch" column's
 * prices as slice counts.
 */
export function isFoodCategory(name) {
    return normalizeCategoryName(name) === 'FOOD';
}

/** The column whose title is softened to "Beverages" while alcohol is off the board. */
export function isNonAlcoholicCategory(name) {
    return /^NON-?\s?ALCOHOLIC\b/.test(normalizeCategoryName(name));
}

/**
 * The heading over a column. With the bar closed there is nothing alcoholic on screen to be the
 * "non" of, so the one non-alcoholic column just reads "Beverages".
 */
export function categoryColumnTitle(name, alcoholEnabled) {
    if (!alcoholEnabled && isNonAlcoholicCategory(name)) return 'Beverages';
    return stripCategoryEmoji(name);
}
