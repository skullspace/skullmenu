/**
 * Determines whether alcohol should currently be shown on the menu board, based on the active
 * event's sellsAlcohol flag and its bar window.
 *
 * The window can arrive in either of two shapes, and this reads BOTH:
 *
 *   barOpensAt / barClosesAt -- full instants (ISO-8601 datetimes, e.g.
 *     "2026-06-05T23:00:00.000Z"). Preferred. Nothing here composes a date with a wall clock,
 *     guesses a timezone, or special-cases a close that lands after midnight: it is two numbers.
 *   barOpenTime / barCloseTime -- the legacy wall-clock strings, parsed by parseTimeToMinutes
 *     below, with a close at or before the open meaning the window runs overnight.
 *
 * The legacy strings are where this board and the register have historically disagreed: the
 * parser below accepts the bare "1800" form an admin can type into an unvalidated field, POS's
 * own parser accepts only "18:00", so an event saved that way advertised a drink here that the
 * till refused to ring up. On a row carrying instants there is no wall clock left to parse, so
 * the two surfaces cannot diverge at all -- that is the point of the new fields, not a
 * side-effect. Until every row is backfilled the divergent parsers are still both live, so the
 * colon-less form stays accepted here rather than being narrowed to match POS.
 *
 * The fallback is load-bearing generally: the new attributes are added and backfilled in the
 * same pass this ships, and every component deploys independently, so a row without them (or a
 * Ticketing-ActiveEvent build that predates the new projection) must open the bar exactly as it
 * does today.
 *
 * No active event, sellsAlcohol:false, or a missing/malformed window in BOTH shapes all fail
 * closed (alcohol hidden).
 */
export function isWithinBarHours(event, now = new Date()) {
	if (!event || !event.sellsAlcohol) return false;

	const window = instantWindow(event);
	if (window) {
		const nowMs = toMillis(now);
		if (nowMs === null) return false;
		return nowMs >= window.opensAt && nowMs < window.closesAt;
	}

	const openMinutes = parseTimeToMinutes(event.barOpenTime);
	const closeMinutes = parseTimeToMinutes(event.barCloseTime);
	if (openMinutes === null || closeMinutes === null) return false;

	const nowMinutes = now.getHours() * 60 + now.getMinutes();

	if (closeMinutes <= openMinutes) {
		// Overnight window (e.g. 18:00 - 02:00): "within" means at/after open OR before close.
		return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
	}
	return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}

/**
 * The instant pair, or null to mean "use the legacy strings".
 *
 * Falls back rather than failing closed in the two cases where the new fields are present but
 * cannot describe a real interval -- unparseable, or closing at/before opening. A window that
 * runs backwards is evidence of a bad write upstream (an 02:00 close that did not get the
 * following day attached, say), and the legacy strings on the same row still describe the night
 * correctly. Failing closed on it instead would blank both alcohol columns on a screen facing
 * the room for a whole event, which is the outcome the fallback exists to prevent.
 */
function instantWindow(event) {
	const opensAt = parseInstant(event.barOpensAt);
	const closesAt = parseInstant(event.barClosesAt);
	if (opensAt === null || closesAt === null) return null;
	if (closesAt <= opensAt) return null;
	return { opensAt, closesAt };
}

/**
 * An ISO-8601 datetime: a date AND a time, offset optional (Appwrite always sends one; a bare
 * local datetime is read in the device's own zone, which is the venue's).
 *
 * Deliberately strict, and specifically stricter than Date.parse, which is the trap here:
 * `new Date("1800")` is not an invalid date, it is the YEAR 1800 -- and "1800" is exactly the
 * wall-clock form this board already accepts below. A value with no date part is never an
 * instant, so the two shapes can never be confused for one another.
 */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i;

export function parseInstant(value) {
	if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!ISO_DATETIME.test(trimmed)) return null;
	const ms = Date.parse(trimmed);
	return Number.isFinite(ms) ? ms : null;
}

function toMillis(now) {
	if (now instanceof Date) return Number.isFinite(now.getTime()) ? now.getTime() : null;
	return parseInstant(now);
}

/**
 * Accepts both the canonical "HH:mm" the admin app's field label asks for AND the bare
 * "HHmm"/"Hmm" digits an admin can just as easily type into it -- that field has no validation
 * at entry, and Verify-Pin's own parser has always accepted both forms. When the two parsers
 * disagreed, an event saved as "1800"/"0200" kept bartender PINs working all night while this
 * board (and the register) silently hid every alcohol item for the whole event, with nothing on
 * screen to say why. Same stored value, same reading, on every surface.
 *
 * Only reached for a row with no usable barOpensAt/barClosesAt pair; on a backfilled row there
 * is no string to parse and this cannot disagree with anything.
 */
export function parseTimeToMinutes(value) {
	if (value === null || value === undefined) return null;
	const cleaned = String(value).trim().replace(":", "");
	if (!/^\d{3,4}$/.test(cleaned)) return null;
	const padded = cleaned.padStart(4, "0");
	const hours = parseInt(padded.slice(0, 2), 10);
	const minutes = parseInt(padded.slice(2), 10);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

/**
 * The admin app's alcohol kill switch (`barData/config` row `alcohol_override_disabled`) -- the
 * documented emergency stop for "the permit window closed" or "an inspector is on site".
 *
 * No Appwrite function reads that row, so the clients are the only place it is ever honoured;
 * there is no server-side enforcement point to fall back on. That makes the unknown case the
 * dangerous one: `settings` is null until the config fetch resolves and stays null when it
 * fails, and reading that as "switch off" would keep a till or a board selling alcohol while
 * the admin app shows the switch as engaged. Unknown therefore fails CLOSED, the same way a
 * missing active event and a malformed bar-hours window already do.
 */
export function isAlcoholOverrideDisabled(settings) {
	if (settings === null || settings === undefined) return true;
	return settings.alcohol_override_disabled === "true";
}

/**
 * The whole alcohol gate in one place: the kill switch, then the active event's bar window.
 * Every "don't know" answer on either half hides alcohol.
 */
export function isAlcoholVisible(activeEvent, settings, now = new Date()) {
	if (isAlcoholOverrideDisabled(settings)) return false;
	return isWithinBarHours(activeEvent, now);
}
