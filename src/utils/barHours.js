/**
 * Determines whether alcohol should currently be shown on the menu board, based on the active
 * event's sellsAlcohol flag and its bar window.
 *
 * The window is now exactly one thing: barOpensAt / barClosesAt, a pair of full instants
 * (ISO-8601 datetimes, e.g. "2026-06-05T23:00:00.000Z"). Nothing here composes a date with a wall
 * clock, guesses a timezone, or special-cases a close that lands after midnight -- the comparison
 * is two numbers.
 *
 * The legacy barOpenTime / barCloseTime strings are gone, and deleting them is the point of this
 * change rather than tidying up after it. Those two fields were the one place this board and the
 * register read the very same stored row and got opposite answers: the parser that used to live
 * here accepted the bare "1800" an admin could type into a field with no validation at entry,
 * POS's accepted only "18:00", so an event saved that way advertised a drink on the TV that the
 * till then refused to ring up -- with nothing on either screen to explain the contradiction. The
 * fix was never a third parser the two sides could finally agree on; it is having no wall clock
 * left to parse. Two surfaces comparing the same two numbers have nothing left to disagree about.
 *
 * This file only ever READS, so no deploy order can make it fail the way a writer would. The
 * ordering fact that does matter here is the reverse one: a row reaching the gate without a
 * usable instant pair now hides alcohol where it used to fall back to the wall clocks. All three
 * live Events rows carry both instants, and Ticketing-ActiveEvent normalizes what it projects to
 * a real instant or to null -- never an empty string, never an unparseable one -- so no live
 * event is affected. A row that somehow arrived without them would go dark rather than guess.
 *
 * Every unknown fails CLOSED (alcohol hidden): no active event, sellsAlcohol:false, a missing
 * instant, an unparseable one, or a pair that does not describe a real interval.
 */
export function isWithinBarHours(event, now = new Date()) {
	if (!event || !event.sellsAlcohol) return false;

	const window = instantWindow(event);
	if (!window) return false;

	const nowMs = toMillis(now);
	if (nowMs === null) return false;
	return nowMs >= window.opensAt && nowMs < window.closesAt;
}

/**
 * The instant pair, or null when the row does not carry a usable one.
 *
 * Returning null used to mean "use the legacy strings instead", and on an inverted pair -- a close
 * at or before the open, the shape a bad backfill makes when an 02:00 close never got the
 * following day attached -- it deliberately chose that fallback over failing closed. The argument
 * was that the wall clocks on the same row still described the night correctly, so believing the
 * inverted pair would blank both alcohol columns on a screen facing the room for an entire event.
 *
 * That argument does not outlive the fields it rested on. With nothing left to fall back TO, an
 * inverted pair leaves two options: hide alcohol, or repair the window by guessing which end of it
 * is wrong. Guessing is exactly what the instants exist to stop, and the two errors are not
 * symmetric -- a board that invents a close time can advertise a drink after the bar's permit
 * window has shut, while a dark alcohol column is a re-save in the admin app that the 60-second
 * poll picks up on its own. So an inverted pair now joins every other unknown and fails closed.
 *
 * The check stays explicit even though the range comparison above is already vacuously false for
 * a backwards window. It is the one place a reader asks what such a window does, and it stops a
 * future overnight-wrap rule -- an instinct carried straight over from the wall clocks, where a
 * close before the open genuinely did mean "tomorrow" -- from quietly reading one as an open bar.
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
 * Deliberately stricter than Date.parse. The trap it was written against is gone from the data but
 * not from the world: `new Date("1800")` is not an invalid date, it is the YEAR 1800, and "1800"
 * is precisely the wall-clock form the retired fields used to hold. A stale payload, a hand-built
 * fixture or a hand-edited row can still put one in front of this, and reading it as a bar that
 * closed two centuries ago would render "Until 12:00 AM" and hide alcohol all night. A value with
 * no date part is not an instant, so it is rejected outright rather than coerced into one.
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
 * The admin app's alcohol kill switch (`barData/config` row `alcohol_override_disabled`) -- the
 * documented emergency stop for "the permit window closed" or "an inspector is on site".
 *
 * No Appwrite function reads that row, so the clients are the only place it is ever honoured;
 * there is no server-side enforcement point to fall back on. That makes the unknown case the
 * dangerous one: `settings` is null until the config fetch resolves and stays null when it
 * fails, and reading that as "switch off" would keep a till or a board selling alcohol while
 * the admin app shows the switch as engaged. Unknown therefore fails CLOSED, the same way a
 * missing active event and an unusable bar window already do.
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
