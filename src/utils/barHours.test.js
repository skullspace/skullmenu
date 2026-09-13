import {
	isWithinBarHours,
	isAlcoholOverrideDisabled,
	isAlcoholVisible,
	parseInstant,
} from "./barHours";

const at = (hours, minutes) => new Date(2026, 0, 1, hours, minutes);
/** Jan 2 -- the far side of midnight, for an overnight window's close. */
const nextDayAt = (hours, minutes) => new Date(2026, 0, 2, hours, minutes);

describe("isWithinBarHours", () => {
	test("no event returns false", () => {
		expect(isWithinBarHours(null, at(20, 0))).toBe(false);
	});

	test("sellsAlcohol:false returns false regardless of time", () => {
		const event = { sellsAlcohol: false, barOpenTime: "18:00", barCloseTime: "23:00" };
		expect(isWithinBarHours(event, at(20, 0))).toBe(false);
	});

	test("missing bar hours fails closed", () => {
		const event = { sellsAlcohol: true };
		expect(isWithinBarHours(event, at(20, 0))).toBe(false);
	});

	test("within a same-day window returns true", () => {
		const event = { sellsAlcohol: true, barOpenTime: "18:00", barCloseTime: "23:00" };
		expect(isWithinBarHours(event, at(20, 0))).toBe(true);
	});

	test("an overnight window is within after midnight, before close", () => {
		const event = { sellsAlcohol: true, barOpenTime: "18:00", barCloseTime: "02:00" };
		expect(isWithinBarHours(event, at(1, 30))).toBe(true);
	});

	test("an overnight window is not within mid-afternoon", () => {
		const event = { sellsAlcohol: true, barOpenTime: "18:00", barCloseTime: "02:00" };
		expect(isWithinBarHours(event, at(14, 0))).toBe(false);
	});
});

// An admin typing "1800"/"0200" into a field labelled "Bar open (HH:mm)" used to be accepted by
// Verify-Pin (pins worked all night) but rejected here, hiding alcohol for the whole event.
describe("isWithinBarHours accepts the colon-less form Verify-Pin already accepts", () => {
	test("a colon-less HHmm window behaves like its HH:mm equivalent", () => {
		const event = { sellsAlcohol: true, barOpenTime: "1800", barCloseTime: "0200" };
		expect(isWithinBarHours(event, at(20, 0))).toBe(true);
		expect(isWithinBarHours(event, at(1, 30))).toBe(true);
		expect(isWithinBarHours(event, at(14, 0))).toBe(false);
	});

	test("a 3-digit Hmm morning time is read as zero-padded, not as HHm", () => {
		const event = { sellsAlcohol: true, barOpenTime: "930", barCloseTime: "1700" };
		expect(isWithinBarHours(event, at(9, 45))).toBe(true);
		expect(isWithinBarHours(event, at(9, 15))).toBe(false);
	});

	test("the two colon forms still parse identically", () => {
		const padded = { sellsAlcohol: true, barOpenTime: "09:30", barCloseTime: "17:00" };
		const bare = { sellsAlcohol: true, barOpenTime: "9:30", barCloseTime: "17:00" };
		expect(isWithinBarHours(padded, at(9, 45))).toBe(true);
		expect(isWithinBarHours(bare, at(9, 45))).toBe(true);
	});

	test("genuinely unparseable and out-of-range values still fail closed", () => {
		const cases = ["", "  ", "later", "18:0:0", "180000", "24:00", "18:75", "2575"];
		cases.forEach((value) => {
			const event = { sellsAlcohol: true, barOpenTime: value, barCloseTime: "02:00" };
			expect(isWithinBarHours(event, at(20, 0))).toBe(false);
		});
	});
});

/**
 * The instant window (barOpensAt/barClosesAt). Every instant below is built from a LOCAL Date
 * and then serialized, so the fixtures describe the same wall clock the legacy strings do no
 * matter which zone the test machine runs in -- which is what lets the three row shapes be
 * compared against one another at all.
 */
const iso = (date) => date.toISOString();

/** 18:00 -> 02:00 next day, in all three shapes. Same night, three ways of saying it. */
const legacyOnly = {
	sellsAlcohol: true,
	barOpenTime: "18:00",
	barCloseTime: "02:00",
};
const instantsOnly = {
	sellsAlcohol: true,
	barOpensAt: iso(at(18, 0)),
	barClosesAt: iso(nextDayAt(2, 0)),
};
const bothShapes = { ...legacyOnly, ...instantsOnly };

describe("isWithinBarHours reads the new instant window", () => {
	test.each([
		["mid-afternoon, before open", at(14, 0), false],
		["the exact minute the bar opens", at(18, 0), true],
		["late evening", at(22, 0), true],
		["after midnight, before close", nextDayAt(1, 30), true],
		["the exact minute the bar closes", nextDayAt(2, 0), false],
		["the morning after", nextDayAt(9, 0), false],
	])("%s: a backfilled row agrees with an un-backfilled one", (_label, now, expected) => {
		// The migration's core promise: whichever shape a row happens to be in right now, the
		// board gets the same window. A half-backfilled collection is a supported state.
		expect(isWithinBarHours(legacyOnly, now)).toBe(expected);
		expect(isWithinBarHours(instantsOnly, now)).toBe(expected);
		expect(isWithinBarHours(bothShapes, now)).toBe(expected);
	});

	test("the instants win when the two shapes disagree", () => {
		const conflicting = {
			sellsAlcohol: true,
			barOpenTime: "09:00",
			barCloseTime: "10:00",
			barOpensAt: iso(at(18, 0)),
			barClosesAt: iso(nextDayAt(2, 0)),
		};
		expect(isWithinBarHours(conflicting, at(22, 0))).toBe(true);
		expect(isWithinBarHours(conflicting, at(9, 30))).toBe(false);
	});

	test("an overnight instant window needs no midnight wrap-around rule", () => {
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

	test("an event carrying neither shape still fails closed", () => {
		expect(isWithinBarHours({ sellsAlcohol: true }, at(22, 0))).toBe(false);
	});

	test("instants offered as Date objects are accepted", () => {
		const event = { sellsAlcohol: true, barOpensAt: at(18, 0), barClosesAt: nextDayAt(2, 0) };
		expect(isWithinBarHours(event, at(22, 0))).toBe(true);
		expect(isWithinBarHours(event, at(14, 0))).toBe(false);
	});
});

describe("isWithinBarHours falls back when the instants are unusable", () => {
	test("garbage instants fall back to the legacy window rather than blanking the bar", () => {
		const event = { ...legacyOnly, barOpensAt: "not-a-date", barClosesAt: "" };
		expect(isWithinBarHours(event, at(22, 0))).toBe(true);
		expect(isWithinBarHours(event, at(14, 0))).toBe(false);
	});

	test("only one of the two instants present falls back to the legacy window", () => {
		const event = { ...legacyOnly, barOpensAt: iso(at(18, 0)) };
		expect(isWithinBarHours(event, at(22, 0))).toBe(true);
	});

	test("an instant window that runs backwards falls back instead of failing closed", () => {
		// The shape a bad backfill makes: an 02:00 close that never got the following day
		// attached. The legacy strings on the same row still describe the night correctly, and
		// believing the inverted pair would blank both alcohol columns for the entire event.
		const event = { ...legacyOnly, barOpensAt: iso(at(18, 0)), barClosesAt: iso(at(2, 0)) };
		expect(isWithinBarHours(event, at(22, 0))).toBe(true);
		expect(isWithinBarHours(event, nextDayAt(1, 30))).toBe(true);
		expect(isWithinBarHours(event, at(14, 0))).toBe(false);
	});

	test("unusable instants with no legacy window left still fail closed", () => {
		const event = { sellsAlcohol: true, barOpensAt: "nope", barClosesAt: "nope" };
		expect(isWithinBarHours(event, at(22, 0))).toBe(false);
	});

	test("a colon-less legacy row is still read here when it has no instants (unchanged)", () => {
		// The divergence is routed around, not converged: this parser keeps accepting "1800"
		// so an un-backfilled row behaves exactly as it does in production today.
		const legacy = { sellsAlcohol: true, barOpenTime: "1800", barCloseTime: "0200" };
		expect(isWithinBarHours(legacy, at(20, 0))).toBe(true);
	});
});

/**
 * The board/register divergence the instants exist to delete. This fixture is byte-identical to
 * the one in POS/src/utils/barHours.test.js, and both sides assert the same answers: "1800"/
 * "0200" parses here and not in POS, so before the instants this exact row showed alcohol on
 * this board while the register hid it. With the instants present neither surface has a wall
 * clock left to parse, so neither can be the odd one out.
 */
describe("the colon-less legacy row that used to split the board from the register", () => {
	const colonless = {
		sellsAlcohol: true,
		barOpenTime: "1800",
		barCloseTime: "0200",
		barOpensAt: "2026-01-02T02:00:00.000Z",
		barClosesAt: "2026-01-02T10:00:00.000Z",
	};

	test("with instants present the board shows alcohol inside the window", () => {
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
		// `new Date("1800")` is not an invalid date -- it is January 1st, 1800. "1800" is also a
		// wall clock this board genuinely accepts, so the two shapes must never be confused.
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
	const openEvent = { sellsAlcohol: true, barOpenTime: "18:00", barCloseTime: "02:00" };

	test("shows alcohol inside bar hours with the switch off", () => {
		expect(isAlcoholVisible(openEvent, {}, at(20, 0))).toBe(true);
	});

	test("the kill switch wins over an open bar window", () => {
		const settings = { alcohol_override_disabled: "true" };
		expect(isAlcoholVisible(openEvent, settings, at(20, 0))).toBe(false);
	});

	test("an unreachable config hides alcohol even inside bar hours", () => {
		expect(isAlcoholVisible(openEvent, null, at(20, 0))).toBe(false);
	});

	test("an unreadable active event hides alcohol even with the switch off", () => {
		expect(isAlcoholVisible(null, {}, at(20, 0))).toBe(false);
	});

	test("the kill switch wins over an open INSTANT window too", () => {
		// The switch is the emergency stop; it sits in front of the window regardless of which
		// shape the window arrived in.
		expect(isAlcoholVisible(instantsOnly, { alcohol_override_disabled: "true" }, at(22, 0))).toBe(false);
		expect(isAlcoholVisible(instantsOnly, null, at(22, 0))).toBe(false);
		expect(isAlcoholVisible(instantsOnly, {}, at(22, 0))).toBe(true);
	});
});
