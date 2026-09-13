import { Client as Appwrite, Databases, Account, Functions, Query } from 'appwrite';

import { useMemo, useState, useEffect, useCallback } from 'react';

import {
    fetchActiveEvent as fetchActiveEventViaFunction,
    ACTIVE_EVENT_OK,
    ACTIVE_EVENT_UNAVAILABLE,
    ACTIVE_EVENT_PENDING
} from '../utils/activeEvent';

export { ACTIVE_EVENT_OK, ACTIVE_EVENT_UNAVAILABLE, ACTIVE_EVENT_PENDING };

// db id 67c9ffd9003d68236514
// items collection id pos_items (the old 67c9ffe6001c17071bb7 / Items_old is retired -- it
//   still holds the cost-of-goods columns, so nothing here should ever read it again)
// category collection id 67c9ffdd0039c4e09c9a

const config = {
    endpoint: 'https://api.cloud.shotty.tech/v1',
    project: '68f2ac7b00002e7563a8',
    databases: {
        products: {
            id: '67c9ffd9003d68236514',
            collections: {
                categories: '67c9ffdd0039c4e09c9a',
                items: 'pos_items'
            }
        },
        data: {
            id: 'barData',
            collections: {
                config: 'config'
            }
        }
    }
};

function createClient() {
    const client = new Appwrite();
    client.setEndpoint(config.endpoint).setProject(config.project);
    return client;
}

export function useAppwrite() {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [data, setData] = useState(null);
    // Two answers, never collapsed into one: ACTIVE_EVENT_OK with event === null means there is
    // genuinely no event tonight; ACTIVE_EVENT_UNAVAILABLE means we could not ask. Both hide
    // alcohol, but only the second is a fault, and only the second gets said on screen.
    const [activeEventState, setActiveEventState] = useState(ACTIVE_EVENT_PENDING);

    const client = useMemo(() => createClient(), []);
    const databases = useMemo(() => new Databases(client), [client]);
    const account = useMemo(() => new Account(client), [client]);
    const functions = useMemo(() => new Functions(client), [client]);

    const refreshCategories = useCallback(async () => {
        console.log('refreshing categories');
        try {
            const data = await databases.listDocuments(
                config.databases.products.id,
                config.databases.products.collections.categories,
                [Query.limit(100)]
            );
            setCategories(data.documents || []);
        } catch (err) {
            console.error('error getting categories', err);
        }
    }, [databases]);

    // Normalize a pos_items document to the field names this app already
    // expects (carried over from the old Items_old schema).
    //
    // `price` is `sale_price` and nothing else. `self_pricing` used to be aliased here as
    // `selfcheck_price` and posted by BarItem in place of the real price whenever alcohol was
    // off (P2-30) -- but no POS code and no function reads that attribute, so the board was the
    // only consumer of a field an operator would reasonably think was kiosk-only. The alias is
    // gone so it cannot quietly come back as a display price.
    function normalizePosItem(doc) {
        return {
            ...doc,
            price: doc.sale_price,
            menu_name: doc.name_menu
        };
    }

    const refreshItems = useCallback(async () => {
        console.log('refreshing items');
        try {
            const data = await databases.listDocuments(
                config.databases.products.id,
                config.databases.products.collections.items, [Query.limit(5000)]);
            setItems((data.documents || []).map(normalizePosItem));
        } catch (err) {
            console.error('error getting items', err);
        }
    }, [databases]);

    const refreshData = useCallback(async () => {
        console.log('refreshing data');
        try {
            const data = await databases.listDocuments(
                config.databases.data.id,
                config.databases.data.collections.config
            );
            let d = data.documents || [];
            let c = {};
            d.forEach((i) => {
                c[i.key] = i.value;
            });
            setData(c || {});
        } catch (err) {
            console.error('error getting data', err);
        }
    }, [databases]);

    // Fetches the currently active event, if any, via the Ticketing-ActiveEvent function. The
    // event is stored WHOLE, never reshaped into a narrower object: the alcohol gate
    // (utils/barHours.js) reads the bar window off it as barOpensAt/barClosesAt, and those two
    // instants are now the only description of the window there is. The legacy
    // barOpenTime/barCloseTime wall clocks have no reader left on this board. Picking fields
    // apart here would risk dropping an instant on the way in, and the gate reads a missing
    // instant as "no bar window" and hides alcohol -- so a reshape bug would surface as a dark
    // alcohol column on a night the bar was open, not as an error anyone would see.
    //
    // This board's anonymous session cannot read the `Events` collection directly (it is
    // restricted to the admin team, and widening it would hand a screen facing the room every
    // event's revenue/profit rollup). A failure comes back as ACTIVE_EVENT_UNAVAILABLE rather
    // than as an empty "no event tonight": both hide alcohol, but only the fault gets a banner on
    // the board (App.js) so the room can see the gate is broken instead of assuming the bar shut.
    const fetchActiveEvent = useCallback(async () => {
        const result = await fetchActiveEventViaFunction(functions);
        if (result.status === ACTIVE_EVENT_UNAVAILABLE) {
            console.error('error fetching active event', result.error);
        }
        setActiveEventState(result);
    }, [functions]);

    useEffect(() => {
        console.log('setting up appwrite subscriptions');
        let mounted = true;

        // Initial fetch. Categories, pos_items and barData/config are all read("any"), so they
        // must NOT wait on the session bootstrap below: a hung account request would otherwise
        // hold back the entire menu instead of just the alcohol gate, and the board's whole job
        // is to have prices on screen.
        refreshCategories();
        refreshItems();
        refreshData();

        // Ticketing-ActiveEvent, and only it, is execute:["users"] -- so ensure the anonymous
        // session exists and wait for it before the first call, or every cold load races a 401.
        (async () => {
            try {
                await account.get();
            } catch (err) {
                try {
                    await account.createAnonymousSession();
                } catch (e) {
                    console.error('error creating session', e);
                }
            }
            if (!mounted) return;
            fetchActiveEvent();
        })();

        // The active event has no usable realtime channel here: Realtime only delivers rows the
        // session can read, and this one cannot read `Events` at all. Poll it instead, so an
        // event going live (or its bar hours being edited) still reaches the board mid-shift.
        const eventPoll = setInterval(fetchActiveEvent, 60000);

        // subscribe to realtime updates
        const topicsCategories = `databases.${config.databases.products.id}.tables.${config.databases.products.collections.categories}.rows`;
        const topicsItems = `databases.${config.databases.products.id}.tables.${config.databases.products.collections.items}.rows`;
        const topicsData = `databases.${config.databases.data.id}.tables.${config.databases.data.collections.config}.rows`;

        const topics = [topicsItems, topicsCategories, topicsData];
        console.log('subscribing to topics', topics);
        const sub = client.subscribe(topics, async (res) => {
            console.log('items update received', res);
            if (!mounted) return;
            await refreshItems();
            await refreshCategories();
            await refreshData();
            await fetchActiveEvent();
        });

        return () => {
            console.log('unsubscribing from appwrite');
            mounted = false;
            clearInterval(eventPoll);
            // cleanup unsubscribe - handle function or object shape
            try {
                if (typeof sub === 'function') sub();
            } catch (e) {
                console.error('error during unsubscribe', e);
            }
        };
    }, [account, client, refreshCategories, refreshItems, refreshData, fetchActiveEvent]);

    useEffect(() => {
        console.log('account changed', account);
    }, [account]);

    useEffect(() => {
        console.log('client changed', client);
    }, [client]);

    useEffect(() => {
        console.log('refreshCategories changed', refreshCategories);
    }, [refreshCategories]);

    useEffect(() => {
        console.log('refreshItems changed', refreshItems);
    }, [refreshItems]);

    useEffect(() => {
        console.log('refreshData changed', refreshData);
    }, [refreshData]);

    return {
        client,
        databases,
        account,
        config,
        categories,
        items,
        refreshCategories,
        refreshItems,
        settings: data,
        activeEvent: activeEventState.event,
        activeEventState,
        fetchActiveEvent
    };
}
