/**
 * doublePrice.js -- one source of truth for the double-shot price the board posts.
 *
 * P1-12: the board hides the separate "<name> DBL" catalog rows and printed the double price off
 * the single row's free-text `dbl_price`, while the register rings the DBL row at its own
 * `sale_price` and never reads `dbl_price` at all. Four of six spirits disagree by $1 live
 * (Tequila 1700 vs 1800; Gin, Spiced and Rye 1500 vs 1600), so the posted price on the board is a
 * dollar under what the customer is actually charged -- on liquor, every time. That was masked
 * only while the alcohol column never rendered.
 *
 * The register is what takes the money, so the register's row wins: when a sellable
 * "<name> DBL" row exists, the board quotes THAT row's price and `dbl_price` is ignored.
 * `dbl_price` remains the fallback for rows with no DBL twin (the food "2 slices" line), so
 * nothing that works today stops working.
 */

/** The same "is this the DBL twin" rule App.js uses to drop those rows from the grid. */
function splitDoubleName(name) {
	const trimmed = typeof name === "string" ? name.trim() : "";
	if (!trimmed.toUpperCase().endsWith("DBL")) return null;
	const base = trimmed.slice(0, -3).trim();
	return base ? base.toUpperCase() : null;
}

/**
 * @param {Array<Object>} items - normalized pos_items (price === sale_price)
 * @returns {Map<string, number>} UPPERCASED base name -> the price the register charges for the
 *   double. Rows that cannot be rung up (`enabled_pos` false) are left out: quoting a price off a
 *   tile the bartender does not have is the same discrepancy pointing the other way.
 */
export function buildDoublePriceIndex(items) {
	const index = new Map();
	(items || []).forEach((item) => {
		if (!item || !item.enabled_pos) return;
		const base = splitDoubleName(item.name);
		if (!base) return;
		const price = item.price ?? item.sale_price;
		if (typeof price !== "number" || !Number.isFinite(price)) return;
		index.set(base, price);
	});
	return index;
}

/**
 * The double price to post for a single-shot row: the register's DBL row if there is one,
 * otherwise the row's own `dbl_price`.
 *
 * @param {Object} item - the single row being rendered
 * @param {Map<string, number>} index - from buildDoublePriceIndex
 * @returns {number|null|undefined}
 */
export function resolveDoublePrice(item, index) {
	const name = typeof item?.name === "string" ? item.name.trim().toUpperCase() : "";
	if (name && index && index.has(name)) return index.get(name);
	return item ? item.dbl_price : undefined;
}
