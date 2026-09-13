import { buildDoublePriceIndex, resolveDoublePrice } from "./doublePrice";

// Live values from the audit (P1-12): the DBL row is what the register actually charges.
const tequila = { $id: "1", name: "Tequila", price: 900, dbl_price: 1700, enabled_pos: true };
const tequilaDbl = { $id: "2", name: "Tequila DBL", price: 1800, enabled_pos: true };
const vodka = { $id: "3", name: "Vodka", price: 800, dbl_price: 1500, enabled_pos: true };
const vodkaDbl = { $id: "4", name: "Vodka DBL", price: 1500, enabled_pos: true };

describe("resolveDoublePrice", () => {
	test("posts the price the register charges, not the drifted dbl_price", () => {
		const index = buildDoublePriceIndex([tequila, tequilaDbl]);
		expect(resolveDoublePrice(tequila, index)).toBe(1800);
		expect(resolveDoublePrice(tequila, index)).not.toBe(tequila.dbl_price);
	});

	test("agrees with dbl_price where the two already agree", () => {
		const index = buildDoublePriceIndex([vodka, vodkaDbl]);
		expect(resolveDoublePrice(vodka, index)).toBe(1500);
	});

	test("falls back to dbl_price when the item has no DBL row (food's 2-slice line)", () => {
		const pizza = { $id: "5", name: "Pizza", price: 300, dbl_price: 500, enabled_pos: true };
		const index = buildDoublePriceIndex([pizza]);
		expect(resolveDoublePrice(pizza, index)).toBe(500);
	});

	test("ignores a DBL row the register cannot ring up", () => {
		const index = buildDoublePriceIndex([
			tequila,
			{ ...tequilaDbl, enabled_pos: false },
		]);
		expect(resolveDoublePrice(tequila, index)).toBe(1700);
	});

	test("matches case-insensitively and tolerates stray whitespace", () => {
		const index = buildDoublePriceIndex([
			{ $id: "6", name: "  rye dbl ", price: 1600, enabled_pos: true },
		]);
		expect(resolveDoublePrice({ name: "Rye", dbl_price: 1500 }, index)).toBe(1600);
	});

	test("a DBL row does not index itself as its own base", () => {
		const index = buildDoublePriceIndex([tequilaDbl]);
		expect(index.has("TEQUILA DBL")).toBe(false);
		expect(index.get("TEQUILA")).toBe(1800);
	});

	test("ignores a DBL row with no usable price", () => {
		const index = buildDoublePriceIndex([
			{ $id: "7", name: "Gin DBL", price: null, enabled_pos: true },
		]);
		expect(resolveDoublePrice({ name: "Gin", dbl_price: 1500 }, index)).toBe(1500);
	});

	test("a bare 'DBL' row indexes nothing", () => {
		expect(buildDoublePriceIndex([{ name: "DBL", price: 100, enabled_pos: true }]).size).toBe(0);
	});
});
