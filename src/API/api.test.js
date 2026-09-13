import { renderHook, waitFor } from '@testing-library/react';

// Appwrite's web SDK opens a websocket and talks to the network on construction, so the whole
// module is stubbed. Names must start with `mock` to survive jest.mock hoisting.
const mockListDocuments = jest.fn();
const mockCreateExecution = jest.fn();
const mockAccountGet = jest.fn();
const mockCreateAnonymousSession = jest.fn();
const mockSubscribe = jest.fn(() => jest.fn());

// Plain constructors, not jest.fn(): react-scripts' jest config sets resetMocks, which would
// strip a mockImplementation off these before the first test ran.
jest.mock('appwrite', () => ({
    Client: function Client() {
        const client = {
            setEndpoint: () => client,
            setProject: () => client,
            subscribe: (...args) => mockSubscribe(...args)
        };
        return client;
    },
    Databases: function Databases() {
        return { listDocuments: (...args) => mockListDocuments(...args) };
    },
    Account: function Account() {
        return {
            get: (...args) => mockAccountGet(...args),
            createAnonymousSession: (...args) =>
                mockCreateAnonymousSession(...args)
        };
    },
    Functions: function Functions() {
        return { createExecution: (...args) => mockCreateExecution(...args) };
    },
    Query: { limit: (n) => `limit(${n})` }
}));

const { useAppwrite, ACTIVE_EVENT_UNAVAILABLE, ACTIVE_EVENT_OK } = require('./api');

const okExecution = (body) => ({
    status: 'completed',
    responseStatusCode: 200,
    responseBody: JSON.stringify(body)
});

beforeEach(() => {
    mockSubscribe.mockReturnValue(jest.fn());
    mockListDocuments.mockResolvedValue({ documents: [] });
    mockAccountGet.mockResolvedValue({ $id: 'session' });
    mockCreateExecution.mockResolvedValue(okExecution({ event: null }));
});

describe('useAppwrite initial fetches', () => {
    test('the public menu reads do not wait on the anonymous-session bootstrap', async () => {
        // Categories, pos_items and barData/config are all read("any"). A hung account.get() must
        // cost us the alcohol gate, not the entire board.
        mockAccountGet.mockReturnValue(new Promise(() => {}));

        renderHook(() => useAppwrite());

        await waitFor(() => expect(mockListDocuments).toHaveBeenCalledTimes(3));
        expect(mockCreateExecution).not.toHaveBeenCalled();
    });

    test('the active-event call waits for the session, which is execute:["users"]', async () => {
        let resolveSession;
        mockAccountGet.mockReturnValue(
            new Promise((resolve) => {
                resolveSession = resolve;
            })
        );

        renderHook(() => useAppwrite());
        await waitFor(() => expect(mockListDocuments).toHaveBeenCalledTimes(3));
        expect(mockCreateExecution).not.toHaveBeenCalled();

        resolveSession({ $id: 'session' });
        await waitFor(() => expect(mockCreateExecution).toHaveBeenCalledTimes(1));
    });
});

describe('useAppwrite active-event state', () => {
    test('a failed execution surfaces as unavailable, not as "no event tonight"', async () => {
        mockCreateExecution.mockResolvedValue({
            status: 'failed',
            responseStatusCode: 0,
            responseBody: ''
        });

        const { result } = renderHook(() => useAppwrite());

        await waitFor(() =>
            expect(result.current.activeEventState.status).toBe(
                ACTIVE_EVENT_UNAVAILABLE
            )
        );
        expect(result.current.activeEvent).toBeNull();
    });

    test('a real "no event tonight" is not reported as a fault', async () => {
        const { result } = renderHook(() => useAppwrite());

        await waitFor(() =>
            expect(result.current.activeEventState.status).toBe(ACTIVE_EVENT_OK)
        );
        expect(result.current.activeEvent).toBeNull();
    });

    test('a live event reaches the board with its bar instants intact', async () => {
        // The hook stores the event exactly as it arrived. barOpensAt/barClosesAt are the whole
        // bar window now, so the instants surviving this hop is the difference between an open
        // bar and a dark alcohol column; they are asserted by name as well as by the whole-object
        // comparison, because that is the failure worth naming in the output.
        const event = {
            $id: 'evt1',
            name: 'HAX 7.0',
            sellsAlcohol: true,
            barOpensAt: '2026-09-11T23:00:00.000Z',
            barClosesAt: '2026-09-12T07:00:00.000Z'
        };
        mockCreateExecution.mockResolvedValue(okExecution({ event }));

        const { result } = renderHook(() => useAppwrite());

        await waitFor(() => expect(result.current.activeEvent).toEqual(event));
        expect(result.current.activeEvent.barOpensAt).toBe(
            '2026-09-11T23:00:00.000Z'
        );
        expect(result.current.activeEvent.barClosesAt).toBe(
            '2026-09-12T07:00:00.000Z'
        );
        expect(result.current.activeEventState.status).toBe(ACTIVE_EVENT_OK);
    });

    test('a row still carrying the retired wall clocks is stored whole, unfiltered', async () => {
        // The shape of the collection between this build reaching the TVs and the attributes being
        // dropped from the schema. Nothing here picks fields out of the event -- a reshape that
        // lost an instant would read as "no bar window" and hide alcohol on a night the bar was
        // open, which is a silent failure, so the event is kept intact instead.
        const event = {
            $id: 'evt1',
            name: 'HAX 7.0',
            sellsAlcohol: true,
            barOpenTime: '18:00',
            barCloseTime: '02:00',
            barOpensAt: '2026-09-11T23:00:00.000Z',
            barClosesAt: '2026-09-12T07:00:00.000Z'
        };
        mockCreateExecution.mockResolvedValue(okExecution({ event }));

        const { result } = renderHook(() => useAppwrite());

        await waitFor(() => expect(result.current.activeEvent).toEqual(event));
    });

    test('an event with no bar instants reaches the board with nothing invented', async () => {
        // No legacy fallback exists to rescue this row any more; the gate fails closed on it. The
        // hook's job is still to hand the gate what the server actually said.
        const event = {
            $id: 'evt1',
            name: 'HAX 7.0',
            sellsAlcohol: true
        };
        mockCreateExecution.mockResolvedValue(okExecution({ event }));

        const { result } = renderHook(() => useAppwrite());

        await waitFor(() => expect(result.current.activeEvent).toEqual(event));
        expect('barOpensAt' in result.current.activeEvent).toBe(false);
    });
});
