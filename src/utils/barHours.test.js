import {
	isWithinBarHours,
	isAlcoholOverrideDisabled,
	isAlcoholVisible,
} from "./barHours";

const at = (hours, minutes) => new Date(2026, 0, 1, hours, minutes);

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
});
