/**
 * activeEvent.js -- fetches the currently active event through the Ticketing-ActiveEvent
 * Appwrite Function instead of reading the `Events` collection directly.
 *
 * The board runs on an anonymous session, which belongs to no team, while `Events` is
 * read-restricted to the admin team -- so a direct client read 401s. The board used to swallow
 * that into "no event tonight", which the alcohol gate reads as "bar closed", so both alcohol
 * columns stayed hidden at every hour. The function reads as the server and returns only the
 * door-safe projection of the event (no revenue/cogs/profit/tips columns ever leave the box).
 *
 * That projection is passed through here whole and unfiltered, and the "unfiltered" half is the
 * load-bearing one. The bar window now arrives in a single shape -- the barOpensAt/barClosesAt
 * instants -- and utils/barHours.js is the only thing that reads it. The retired barOpenTime/
 * barCloseTime wall clocks are nothing this board looks at any more, but they are not stripped
 * here either: whatever the function projects is handed over as it arrived. Filtering to an
 * allowlist at this layer would put a second, silent place where a field the gate needs could go
 * missing, and a board whose instants were quietly dropped on the way in fails closed -- a dark
 * alcohol column for a whole event, with the row itself looking perfectly correct in the admin
 * app. Ticketing-ActiveEvent already owns the allowlist; this file must not own a second one.
 *
 * The states below are deliberately the same two the POS's own
 * POS/src/utils/api.js#parseActiveEventExecution returns, parsed by the same three checks, so the
 * register and this board cannot end up with opposite readings of the same execution.
 */

export const TICKETING_ACTIVE_EVENT_FUNCTION_ID = "ticketing-active-event";

/** fetchActiveEvent result states -- see parseActiveEventExecution. */
export const ACTIVE_EVENT_OK = "ok";
export const ACTIVE_EVENT_UNAVAILABLE = "unavailable";

/**
 * State before the first lookup has answered -- the same third state the POS keeps
 * (pos.js's ACTIVE_EVENT_PENDING). Deliberately NOT "ok with no event": until the server has
 * spoken we do not know whether the bar is open, and saying "Bar Closed" as though we did is a
 * milder version of the same bug. Alcohol stays hidden while pending.
 */
export const ACTIVE_EVENT_PENDING = Object.freeze({
	status: "pending",
	event: null,
	error: null,
});

function unavailable(reason) {
	return {
		status: ACTIVE_EVENT_UNAVAILABLE,
		event: null,
		error: `Could not check the active event: ${reason}`,
	};
}

/**
 * Turn a Ticketing-ActiveEvent execution into one of exactly two answers, which the caller must
 * keep apart:
 *
 *   { status: "ok", event: {...} | null }         -- the server answered. A null event means
 *                                                    there genuinely is no event tonight.
 *   { status: "unavailable", event: null, error } -- we do NOT know; the lookup failed.
 *
 * Collapsing the second into the first is the exact bug this file exists to end (a 401 on the old
 * direct Events read reading as "no event"), so every non-answer here is unavailable, never an
 * empty event. In particular an execution that is waiting/processing/failed -- function timeout,
 * runtime crash, bad build -- carries an EMPTY responseBody with the reason in `errors`, which
 * would otherwise JSON.parse into a convincing-looking "no event tonight".
 *
 * @param {Object} execution - Appwrite Models.Execution from functions.createExecution
 * @returns {{status: string, event: Object|null, error: string|null}}
 */
export function parseActiveEventExecution(execution) {
	if (!execution) return unavailable("the function returned nothing");
	if (execution.status !== "completed") {
		return unavailable(`the function did not run (status: ${execution.status || "unknown"})`);
	}
	if (execution.responseStatusCode !== 200) {
		return unavailable(`the function returned HTTP ${execution.responseStatusCode}`);
	}

	let payload;
	try {
		payload = JSON.parse(execution.responseBody || "");
	} catch (err) {
		return unavailable("the response could not be read");
	}

	// `event` is always present on a success, including as an explicit null. Its absence means we
	// got the function's own error body (or something else entirely), not an answer.
	if (!payload || typeof payload !== "object" || !("event" in payload)) {
		return unavailable(
			payload && payload.error
				? String(payload.error)
				: "the response was not in the expected shape"
		);
	}

	return { status: ACTIVE_EVENT_OK, event: payload.event || null, error: null };
}

/**
 * @param {Functions} functions - Appwrite Functions client (web SDK 17: positional args)
 * @returns {Promise<{status: string, event: Object|null, error: string|null}>} never throws and
 *   never reports a fault as "no event tonight" -- a transport/permission failure comes back as
 *   ACTIVE_EVENT_UNAVAILABLE so the caller can say so on screen. Both states still hide alcohol;
 *   only one of them is a fault.
 */
export async function fetchActiveEvent(functions) {
	let execution;
	try {
		execution = await functions.createExecution({
			functionId: TICKETING_ACTIVE_EVENT_FUNCTION_ID,
			body: JSON.stringify({}),
		});
	} catch (err) {
		return unavailable((err && err.message) || "the request failed");
	}
	return parseActiveEventExecution(execution);
}

/**
 * fetchActiveEvent, plus the one recovery the board cannot live without.
 *
 * The board is a kiosk tab that stays open for WEEKS, and its anonymous session does not last that
 * long -- Admin-PurgeAnonymousUsers reaps inactive anonymous users, and sessions expire on their
 * own. The session is established once when the app mounts, so a session that dies mid-shift means
 * every poll from then on is a 401. The alcohol gate fails closed on that, so the board hides every
 * drink, all night, with nothing on the wall saying why, until a human thinks to reload the page.
 *
 * Recovery is gated on account.get() rather than on the error text. `unavailable` also covers the
 * backend simply being down, and minting a fresh anonymous user every 60 seconds against a dead
 * server would leave a trail of them for the purge to clean up later. Only a session that is
 * genuinely gone gets replaced, and only a successful replacement earns the one retry.
 */
export async function fetchActiveEventWithSessionRecovery(functions, account) {
	const first = await fetchActiveEvent(functions);
	if (first.status !== ACTIVE_EVENT_UNAVAILABLE) return first;

	try {
		await account.get();
		// Session is alive, so the failure was something else -- do not retry.
		return first;
	} catch (sessionGone) {
		try {
			await account.createAnonymousSession();
		} catch (couldNotRecreate) {
			return first;
		}
	}
	return fetchActiveEvent(functions);
}
