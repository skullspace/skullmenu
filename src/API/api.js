import { Client as Appwrite, Databases, Account } from 'appwrite';

import { useMemo, useState, useEffect, useCallback } from 'react';

// db id 67c9ffd9003d68236514
// items collection id 67c9ffe6001c17071bb7
// category collection id 67c9ffdd0039c4e09c9a

const config = {
    endpoint: 'https://api.cloud.shotty.tech/v1',
    project: '68f2ac7b00002e7563a8',
    databases: {
        products: {
            id: '67c9ffd9003d68236514',
            collections: {
                categories: '67c9ffdd0039c4e09c9a',
                items: '67c9ffe6001c17071bb7'
            }
        },
        data: {
            id: 'barData',
            collections: {
                config: 'config'
            }
        }
    }
}

function createClient() {
    const client = new Appwrite();
    client.setEndpoint(config.endpoint).setProject(config.project);
    return client;
}

export function useAppwrite() {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [data, setData] = useState(null);

    const client = useMemo(() => createClient(), []);
    const databases = useMemo(() => new Databases(client), [client]);
    const account = useMemo(() => new Account(client), [client]);

    const refreshCategories = useCallback(async () => {
        try {
            const data = await databases.listDocuments(
                config.databases.products.id,
                config.databases.products.collections.categories
            );
            setCategories(data.documents || []);
        } catch (err) {
            console.error('error getting categories', err);
        }
    }, [databases]);

    const refreshItems = useCallback(async () => {
        try {
            const data = await databases.listDocuments(
                config.databases.products.id,
                config.databases.products.collections.items
            );
            setItems(data.documents || []);
        } catch (err) {
            console.error('error getting items', err);
        }
    }, [databases]);

    const refreshData = useCallback(async () => {
        try {
            const data = await databases.listDocuments(
                config.databases.data.id,
                config.databases.data.collections.config
            );
            let d = data.documents || [];
            let c = {};
            d.forEach((i) => {
                c[i.key] = i.value;
            })
            setData(c || {});
        } catch (err) {
            console.error('error getting data', err);
        }
    }, [databases]);

    useEffect(() => {
        let mounted = true;

        // Ensure anonymous session exists (run once)
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
        })();

        // initial fetch
        refreshCategories();
        refreshItems();
        refreshData();

        // subscribe to realtime updates
        const topicsCategories = [
            `databases.${config.databases.products.id}.collections.${config.databases.products.collections.categories}.documents`
        ];
        const topicsItems = [
            `databases.${config.databases.products.id}.collections.${config.databases.products.collections.items}.documents`
        ];
        const topicsData = [
            `databases.${config.databases.data.id}.collections.${config.databases.data.collections.config}.documents`
        ];

        const subCategories = client.subscribe(topicsCategories, async () => {
            if (!mounted) return;
            await refreshCategories();
        });
        const subItems = client.subscribe(topicsItems, async () => {
            if (!mounted) return;
            await refreshItems();
        });
        const subData = client.subscribe(topicsData, async () => {
            if (!mounted) return;
            await refreshData();
        });

        return () => {
            mounted = false;
            // cleanup unsubscribe - handle function or object shape
            try {
                if (typeof subCategories === 'function') subCategories();
                else if (subCategories && typeof subCategories.unsubscribe === 'function') subCategories.unsubscribe();
            } catch (e) {
                // ignore
            }
            try {
                if (typeof subItems === 'function') subItems();
                else if (subItems && typeof subItems.unsubscribe === 'function') subItems.unsubscribe();
            } catch (e) {
                // ignore
            }
            try {
                if (typeof subData === 'function') subData();
                else if (subData && typeof subData.unsubscribe === 'function') subData.unsubscribe();
            } catch (e) {
                // ignore
            }
        };
    }, [account, client, refreshCategories, refreshItems, refreshData]);

    return {
        client,
        databases,
        account,
        config,
        categories,
        items,
        refreshCategories,
        refreshItems,
        settings: data
    };
}
