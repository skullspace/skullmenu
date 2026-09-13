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

	test("returns the event's public projection with its bar instants intact", async () => {
		// The bar window is barOpensAt/barClosesAt and nothing else now. Those two fields are the
		// only thing standing between the board and a dark alcohol column, so the assertion is
		// deliberately on the whole object: anything this layer quietly dropped would fail here
		// rather than at 10pm on an event night.
		const event = {
			$id: "evt1",
			name: "HAX 7.0",
			sellsAlcohol: true,
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

	test("passes a row through whole, including fields this board no longer reads", async () => {
		// Between this build reaching the TVs and the retired attributes being dropped from the
		// schema, the projection may still carry barOpenTime/barCloseTime. This layer neither
		// strips them nor cares about them: whatever the function sent is what the caller gets.
		// The allowlist lives in Ticketing-ActiveEvent, and a second one here would just be another
		// place an instant could go missing without anyone noticing until the bar looked shut.
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
		const result = await fetchActiveEvent(functions);
		expect(result.status).toBe(ACTIVE_EVENT_OK);
		expect(result.event).toEqual(event);
	});

	test("a row with no bar instants arrives as it is, with nothing invented to cover for it", async () => {
		// This used to be the row the gate's legacy fallback rescued. There is no fallback now: the
		// honest thing is to hand the gate exactly what the server sent and let it fail closed,
		// rather than to synthesize a window here out of whatever else is on the row.
		const event = {
			$id: "evt1",
			name: "HAX 7.0",
			sellsAlcohol: true,
		};
		const functions = {
			createExecution: jest.fn().mockResolvedValue(execution({ event })),
		};
		const result = await fetchActiveEvent(functions);
		expect(result.status).toBe(ACTIVE_EVENT_OK);
		expect(result.event).toEqual(event);
		expect("barOpensAt" in result.event).toBe(false);
		expect("barClosesAt" in result.event).toBe(false);
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
