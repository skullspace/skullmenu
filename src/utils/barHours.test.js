import {
	isWithinBarHours,
	isAlcoholOverrideDisabled,
	isAlcoholVisible,
	parseInstant,
} from "./barHours";

const at = (hours, minutes) => new Date(2026, 0, 1, hours, minutes);
/** Jan 2 -- the far side of midnight, for an overnight window's close. */
const nextDayAt = (hours, minutes) => new Date(2026, 0, 2, hours, minutes);

/**
 * Every instant below is built from a LOCAL Date and then serialized, so the fixtures describe the
 * same wall clock whichever zone the test machine runs in.
 */
const iso = (date) => date.toISOString();

/** 18:00 -> 02:00 the next day: the venue's ordinary night, as two instants. */
const instantsOnly = {
	sellsAlcohol: true,
	barOpensAt: iso(at(18, 0)),
	barClosesAt: iso(nextDayAt(2, 0)),
};

describe("isWithinBarHours", () => {
	test("no event returns false", () => {
		expect(isWithinBarHours(null, at(20, 0))).toBe(false);
	});

	test("sellsAlcohol:false returns false regardless of time", () => {
		expect(isWithinBarHours({ ...instantsOnly, sellsAlcohol: false }, at(20, 0))).toBe(false);
	});

	test("missing bar hours fails closed", () => {
		const event = { sellsAlcohol: true };
		expect(isWithinBarHours(event, at(20, 0))).toBe(false);
	});

	test("within a same-day window returns true", () => {
		const event = {
			sellsAlcohol: true,
			barOpensAt: iso(at(18, 0)),
			barClosesAt: iso(at(23, 0)),
		};
		expect(isWithinBarHours(event, at(20, 0))).toBe(true);
	});

	test("an overnight window is within after midnight, before close", () => {
		expect(isWithinBarHours(instantsOnly, at(1, 30))).toBe(false);
		expect(isWithinBarHours(instantsOnly, nextDayAt(1, 30))).toBe(true);
	});

	test("an overnight window is not within mid-afternoon", () => {
		expect(isWithinBarHours(instantsOnly, at(14, 0))).toBe(false);
	});
});

describe("isWithinBarHours reads the instant window", () => {
	test.each([
		["mid-afternoon, before open", at(14, 0), false],
		["the exact minute the bar opens", at(18, 0), true],
		["late evening", at(22, 0), true],
		["after midnight, before close", nextDayAt(1, 30), true],
		["the exact minute the bar closes", nextDayAt(2, 0), false],
		["the morning after", nextDayAt(9, 0), false],
	])("%s", (_label, now, expected) => {
		expect(isWithinBarHours(instantsOnly, now)).toBe(expected);
	});

	test("an overnight instant window needs no midnight wrap-around rule", () => {
		// Two numbers and a range test. The wall clocks needed a special case here ("a close at or
		// before the open means tomorrow"); instants carry the date, so there is nothing to encode.
		expect(isWithinBarHours(instantsOnly, nextDayAt(0, 0))).toBe(true);
		expect(isWithinBarHours(instantsOnly, nextDayAt(1, 59))).toBe(true);
	});

	test("a same-day instant window closes the same day", () => {
		const daytime = {
			sellsAlcohol: true,
			barOpensAt: iso(at(12, 0)),
			barClosesAt: iso(at(17, 0)),
		};
		expect(isWithinBarHours(daytime, at(13, 0))).toBe(true);
		expect(isWithinBarHours(daytime, at(23, 0))).toBe(false);
		expect(isWithinBarHours(daytime, nextDayAt(13, 0))).toBe(false);
	});

	test("sellsAlcohol:false still wins over a wide-open instant window", () => {
		expect(isWithinBarHours({ ...instantsOnly, sellsAlcohol: false }, at(22, 0))).toBe(false);
	});

	test("an event carrying no window at all fails closed", () => {
		expect(isWithinBarHours({ sellsAlcohol: true }, at(22, 0))).toBe(false);
	});

	test("instants offered as Date objects are accepted", () => {
		const event = { sellsAlcohol: true, barOpensAt: at(18, 0), barClosesAt: nextDayAt(2, 0) };
		expect(isWithinBarHours(event, at(22, 0))).toBe(true);
		expect(isWithinBarHours(event, at(14, 0))).toBe(false);
	});
});

/**
 * The retired wall clocks are no longer read, in any form.
 *
 * This board's parser used to accept the bare "1800" that POS's rejected, so one stored row opened
 * the bar here and not at the till. The divergence is not resolved by agreeing on a parser -- it is
 * resolved by there being no parser. These tests pin the deletion: a row offering only the retired
 * strings has no window at all, and one that still carries them alongside the instants is read
 * exactly as if it did not.
 */
describe("the retired wall clocks have no reader left", () => {
	test.each([
		["colon-less, the form that used to split the board from the register", "1800", "0200"],
		["the canonical form the admin field asked for", "18:00", "02:00"],
		["the 3-digit morning form", "930", "1700"],
	])("a row carrying only %s fails closed", (_label, barOpenTime, barCloseTime) => {
		const legacyOnly = { sellsAlcohol: true, barOpenTime, barCloseTime };
		expect(isWithinBarHours(legacyOnly, at(20, 0))).toBe(false);
		expect(isWithinBarHours(legacyOnly, at(9, 45))).toBe(false);
		expect(isWithinBarHours(legacyOnly, nextDayAt(1, 30))).toBe(false);
	});

	test("leftover legacy keys are ignored, not consulted, when instants are present", () => {
		// The state the collection is in between this build reaching the TVs and the attributes
		// being dropped from the schema: the strings are still on the row, and still wrong. The
		// window must come from the instants alone.
		const withLeftovers = {
			...instantsOnly,
			barOpenTime: "09:00",
			barCloseTime: "10:00",
		};
		expect(isWithinBarHours(withLeftovers, at(22, 0))).toBe(true);
		expect(isWithinBarHours(withLeftovers, at(9, 30))).toBe(false);
	});
});

describe("isWithinBarHours fails closed when the instants are unusable", () => {
	test("unparseable instants fail closed", () => {
		expect(isWithinBarHours({ sellsAlcohol: true, barOpensAt: "nope", barClosesAt: "nope" }, at(22, 0))).toBe(false);
		expect(isWithinBarHours({ sellsAlcohol: true, barOpensAt: "not-a-date", barClosesAt: "" }, at(22, 0))).toBe(false);
	});

	test("only one of the two instants present fails closed", () => {
		expect(isWithinBarHours({ sellsAlcohol: true, barOpensAt: iso(at(18, 0)) }, at(22, 0))).toBe(false);
		expect(isWithinBarHours({ sellsAlcohol: true, barClosesAt: iso(nextDayAt(2, 0)) }, at(22, 0))).toBe(false);
	});

	test("an unparseable instant is not rescued by leftover legacy strings on the same row", () => {
		// This is the assertion that changed direction with the migration, and it changed on
		// purpose. A row like this used to read its window off barOpenTime/barCloseTime and open
		// the bar; there is nothing to fall back to now, so it fails closed like every other
		// unknown. No live row is in this shape -- Ticketing-ActiveEvent normalizes each instant to
		// a real value or to null before it ever leaves the server.
		const event = {
			sellsAlcohol: true,
			barOpenTime: "18:00",
			barCloseTime: "02:00",
			barOpensAt: "not-a-date",
			barClosesAt: "",
		};
		expect(isWithinBarHours(event, at(22, 0))).toBe(false);
	});

	test("an instant window that runs backwards fails closed", () => {
		// The shape a bad backfill makes: an 02:00 close that never got the following day attached.
		// This used to fall back to the wall clocks rather than blank the columns for a whole
		// event. With nothing left to fall back to, the choice is between hiding alcohol and
		// guessing which end of the window is wrong -- and a board that guesses can advertise a
		// drink after the permit window has shut. It hides.
		const backwards = {
			sellsAlcohol: true,
			barOpensAt: iso(at(18, 0)),
			barClosesAt: iso(at(2, 0)),
		};
		expect(isWithinBarHours(backwards, at(22, 0))).toBe(false);
		expect(isWithinBarHours(backwards, nextDayAt(1, 30))).toBe(false);
		expect(isWithinBarHours(backwards, at(14, 0))).toBe(false);
	});

	test("a zero-length window is never open, including at its own instant", () => {
		const zero = { sellsAlcohol: true, barOpensAt: iso(at(18, 0)), barClosesAt: iso(at(18, 0)) };
		expect(isWithinBarHours(zero, at(18, 0))).toBe(false);
	});
});

/**
 * The board/register divergence the instants exist to delete, pinned on the exact row that caused
 * it. This fixture still carries the retired "1800"/"0200" strings on purpose: it is the row that
 * used to show alcohol here and hide it at the till, and with the wall clocks unread by either
 * surface the two now answer from the same two numbers.
 */
describe("the colon-less legacy row that used to split the board from the register", () => {
	const colonless = {
		sellsAlcohol: true,
		barOpenTime: "1800",
		barCloseTime: "0200",
		barOpensAt: "2026-01-02T02:00:00.000Z",
		barClosesAt: "2026-01-02T10:00:00.000Z",
	};

	test("the board shows alcohol inside the window", () => {
		expect(isWithinBarHours(colonless, new Date("2026-01-02T02:00:00.000Z"))).toBe(true);
		expect(isWithinBarHours(colonless, new Date("2026-01-02T04:00:00.000Z"))).toBe(true);
		expect(isWithinBarHours(colonless, new Date("2026-01-02T09:59:00.000Z"))).toBe(true);
	});

	test("and hides it outside the window", () => {
		expect(isWithinBarHours(colonless, new Date("2026-01-02T01:59:00.000Z"))).toBe(false);
		expect(isWithinBarHours(colonless, new Date("2026-01-02T10:00:00.000Z"))).toBe(false);
	});
});

describe("parseInstant", () => {
	test("accepts the ISO shapes an Appwrite datetime attribute comes back as", () => {
		expect(parseInstant("2026-06-05T01:00:00.000Z")).toBe(Date.parse("2026-06-05T01:00:00Z"));
		expect(parseInstant("2026-06-05T01:00:00.000+00:00")).toBe(Date.parse("2026-06-05T01:00:00Z"));
		expect(parseInstant("2026-06-05T01:00:00-05:00")).toBe(Date.parse("2026-06-05T06:00:00Z"));
		expect(parseInstant("  2026-06-05T01:00:00Z  ")).toBe(Date.parse("2026-06-05T01:00:00Z"));
		expect(parseInstant(new Date("2026-06-05T01:00:00Z"))).toBe(Date.parse("2026-06-05T01:00:00Z"));
	});

	test("rejects a bare wall clock instead of reading it as the year 1800", () => {
		// `new Date("1800")` is not an invalid date -- it is January 1st, 1800. The retired fields
		// held exactly this form, and a stale payload or a hand-edited row can still present one,
		// so the strictness outlives the fields it was written against.
		expect(parseInstant("1800")).toBeNull();
		expect(parseInstant("18:00")).toBeNull();
		expect(parseInstant("0200")).toBeNull();
	});

	test("rejects a date with no time, and anything that is not a string or Date", () => {
		expect(parseInstant("2026-06-05")).toBeNull();
		expect(parseInstant(null)).toBeNull();
		expect(parseInstant(undefined)).toBeNull();
		expect(parseInstant(1780000000000)).toBeNull();
		expect(parseInstant("")).toBeNull();
		expect(parseInstant("2026-13-45T99:99:99Z")).toBeNull();
		expect(parseInstant(new Date("nope"))).toBeNull();
	});
});

// The kill switch has no server-side enforcement point -- no Appwrite function reads
// barData/config -- so an unknown config must not read as "switch off".
describe("isAlcoholOverrideDisabled", () => {
	test("config that never loaded fails closed (treated as override ON)", () => {
		expect(isAlcoholOverrideDisabled(null)).toBe(true);
		expect(isAlcoholOverrideDisabled(undefined)).toBe(true);
	});

	test("a loaded config without the key means the switch is off", () => {
		expect(isAlcoholOverrideDisabled({})).toBe(false);
		expect(isAlcoholOverrideDisabled({ alcohol_override_disabled: "false" })).toBe(false);
	});

	test("the switch is on only for the exact string the admin app writes", () => {
		expect(isAlcoholOverrideDisabled({ alcohol_override_disabled: "true" })).toBe(true);
	});
});

describe("isAlcoholVisible", () => {
	test("shows alcohol inside bar hours with the switch off", () => {
		expect(isAlcoholVisible(instantsOnly, {}, at(20, 0))).toBe(true);
	});

	test("the kill switch wins over an open bar window", () => {
		const settings = { alcohol_override_disabled: "true" };
		expect(isAlcoholVisible(instantsOnly, settings, at(20, 0))).toBe(false);
	});

	test("an unreachable config hides alcohol even inside bar hours", () => {
		expect(isAlcoholVisible(instantsOnly, null, at(20, 0))).toBe(false);
	});

	test("an unreadable active event hides alcohol even with the switch off", () => {
		expect(isAlcoholVisible(null, {}, at(20, 0))).toBe(false);
	});

	test("the switch sits in front of the window, not beside it", () => {
		expect(isAlcoholVisible(instantsOnly, { alcohol_override_disabled: "true" }, at(22, 0))).toBe(false);
		expect(isAlcoholVisible(instantsOnly, null, at(22, 0))).toBe(false);
		expect(isAlcoholVisible(instantsOnly, {}, at(22, 0))).toBe(true);
	});
});
