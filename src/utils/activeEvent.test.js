import {
	fetchActiveEvent,
	parseActiveEventExecution,
	ACTIVE_EVENT_OK,
	ACTIVE_EVENT_UNAVAILABLE,
	TICKETING_ACTIVE_EVENT_FUNCTION_ID,
} from "./activeEvent";

/** A synchronous execution that actually ran and answered. */
const execution = (body) => ({
	status: "completed",
	responseStatusCode: 200,
	responseBody: JSON.stringify(body),
});

describe("fetchActiveEvent", () => {
	test("calls the Ticketing-ActiveEvent function, not the Events collection", async () => {
		const functions = {
			createExecution: jest.fn().mockResolvedValue(execution({ event: null })),
		};
		await fetchActiveEvent(functions);
		expect(functions.createExecution).toHaveBeenCalledWith(
			TICKETING_ACTIVE_EVENT_FUNCTION_ID,
			JSON.stringify({})
		);
	});

	test("returns the event's public projection, bar-hours fields included", async () => {
		// Mid-migration shape: the instants the gate prefers AND the legacy wall clocks it falls
		// back to, both carried through untouched. barHours.js decides between them, not this.
		const event = {
			$id: "evt1",
			name: "HAX 7.0",
			sellsAlcohol: true,
			barOpenTime: "18:00",
			barCloseTime: "02:00",
			barOpensAt: "2026-09-11T23:00:00.000Z",
			barClosesAt: "2026-09-12T07:00:00.000Z",
		};
		const functions = {
			createExecution: jest.fn().mockResolvedValue(execution({ event })),
		};
		await expect(fetchActiveEvent(functions)).resolves.toEqual({
			status: ACTIVE_EVENT_OK,
			event,
			error: null,
		});
	});

	test("passes through a row that has not been backfilled yet, untouched", async () => {
		// A function build that predates the instants, or a row the backfill has not reached.
		// Nothing here may invent or drop a field -- the gate's fallback needs the row as-is.
		const event = {
			$id: "evt1",
			name: "HAX 7.0",
			sellsAlcohol: true,
			barOpenTime: "18:00",
			barCloseTime: "02:00",
		};
		const functions = {
			createExecution: jest.fn().mockResolvedValue(execution({ event })),
		};
		const result = await fetchActiveEvent(functions);
		expect(result.status).toBe(ACTIVE_EVENT_OK);
		expect(result.event).toEqual(event);
		expect("barOpensAt" in result.event).toBe(false);
	});

	test("no event running is an answer, not a fault", async () => {
		const functions = {
			createExecution: jest.fn().mockResolvedValue(execution({ event: null })),
		};
		await expect(fetchActiveEvent(functions)).resolves.toEqual({
			status: ACTIVE_EVENT_OK,
			event: null,
			error: null,
		});
	});

	test("a transport failure is reported as unavailable, never as 'no event'", async () => {
		const functions = {
			createExecution: jest.fn().mockRejectedValue(new Error("timeout")),
		};
		const result = await fetchActiveEvent(functions);
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.event).toBeNull();
		expect(result.error).toContain("timeout");
	});

	test("a function-level error body is reported as unavailable, with its message", async () => {
		const functions = {
			createExecution: jest
				.fn()
				.mockResolvedValue(execution({ error: "Failed to load the active event" })),
		};
		const result = await fetchActiveEvent(functions);
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.error).toContain("Failed to load the active event");
	});
});

describe("parseActiveEventExecution", () => {
	// The regression this whole file exists for: a queued/processing/failed execution carries an
	// empty responseBody, which used to parse into a convincing-looking "no event tonight" and
	// silently blanked every alcohol item on a customer-facing board.
	test("an execution that never completed is unavailable, not 'no event'", () => {
		const result = parseActiveEventExecution({
			status: "failed",
			responseStatusCode: 0,
			responseBody: "",
		});
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.event).toBeNull();
		expect(result.error).toContain("failed");
	});

	test("a still-processing execution is unavailable", () => {
		const result = parseActiveEventExecution({
			status: "processing",
			responseStatusCode: 0,
			responseBody: "",
		});
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.event).toBeNull();
	});

	test("a non-200 response is unavailable and names the status code", () => {
		const result = parseActiveEventExecution({
			status: "completed",
			responseStatusCode: 500,
			responseBody: JSON.stringify({ error: "Failed to load the active event" }),
		});
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.event).toBeNull();
		expect(result.error).toContain("500");
	});

	test("a 401 on the execution itself is unavailable", () => {
		const result = parseActiveEventExecution({
			status: "completed",
			responseStatusCode: 401,
			responseBody: "",
		});
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.error).toContain("401");
	});

	test("an empty body on an otherwise-200 execution is unavailable, not 'no event'", () => {
		const result = parseActiveEventExecution({
			status: "completed",
			responseStatusCode: 200,
			responseBody: "",
		});
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.event).toBeNull();
	});

	test("a body without an `event` key is unavailable, not 'no event'", () => {
		const result = parseActiveEventExecution({
			status: "completed",
			responseStatusCode: 200,
			responseBody: JSON.stringify({ ok: true }),
		});
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.event).toBeNull();
	});

	test("nothing at all is unavailable", () => {
		const result = parseActiveEventExecution(undefined);
		expect(result.status).toBe(ACTIVE_EVENT_UNAVAILABLE);
		expect(result.event).toBeNull();
	});

	test("an explicit null event on a completed 200 is a real 'no event tonight'", () => {
		const result = parseActiveEventExecution({
			status: "completed",
			responseStatusCode: 200,
			responseBody: JSON.stringify({ event: null }),
		});
		expect(result).toEqual({ status: ACTIVE_EVENT_OK, event: null, error: null });
	});
});
