/**
 * Determines whether alcohol should currently be shown, based on the active event's
 * sellsAlcohol flag and barOpenTime/barCloseTime window (set via the admin app's Events
 * screen) -- "HH:mm" strings, e.g. "18:00"/"02:00". Handles a window that crosses midnight
 * (close time earlier than open time means overnight).
 *
 * Ported verbatim from the POS app's own src/utils/barHours.js, so this menu board and the
 * staff POS always agree on whether alcohol is being sold right now -- both read the exact
 * same active event, the exact same way.
 *
 * No active event, sellsAlcohol:false, or a missing/malformed time window all fail closed
 * (alcohol hidden).
 */
export function isWithinBarHours(event, now = new Date()) {
	if (!event || !event.sellsAlcohol) return false;

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
 * Accepts both the canonical "HH:mm" the admin app's field label asks for AND the bare
 * "HHmm"/"Hmm" digits an admin can just as easily type into it -- that field has no validation
 * at entry, and Verify-Pin's own parser has always accepted both forms. When the two parsers
 * disagreed, an event saved as "1800"/"0200" kept bartender PINs working all night while this
 * board (and the register) silently hid every alcohol item for the whole event, with nothing on
 * screen to say why. Same stored value, same reading, on every surface.
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
 * The whole alcohol gate in one place: the kill switch, then the active event's bar-hours
 * window. Every "don't know" answer on either half hides alcohol.
 */
export function isAlcoholVisible(activeEvent, settings, now = new Date()) {
	if (isAlcoholOverrideDisabled(settings)) return false;
	return isWithinBarHours(activeEvent, now);
}
