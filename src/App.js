import React, { useEffect, useState } from 'react';
// import appwrite
import { Client as Appwrite, Databases, Account } from 'appwrite';

import BarItem from './components/BarItem';
import Footer from './components/Footer';
import Header from './components/Header';

export default function App() {

    // Init appwrite
    const client = new Appwrite();

    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);

    client.setEndpoint('https://api.cloud.shotty.tech/v1').setProject('67c9ff7a0013c21e2b40');

    const account = new Account(client);
    // if not logged in, create anonymous session

    account.get().then(() => {
        console.log('logged in');
    }).catch(() => {
        console.log('not logged in');
        account.createAnonymousSession().then(() => {
            console.log('created session');
        }).catch((error) => {
            console.log('error creating session', error);
        });
    });

    useEffect(() => {
        // Init database
        const database = new Databases(client);

        // db id 67c9ffd9003d68236514
        // items collection id 67c9ffe6001c17071bb7
        // category collection id 67c9ffdd0039c4e09c9a

        client.subscribe.bind(client)([
            "databases.67c9ffd9003d68236514.collections.67c9ffdd0039c4e09c9a.documents",
        ], async () => {
            let data = await database.listDocuments('67c9ffd9003d68236514', '67c9ffdd0039c4e09c9a')
            setCategories(data.documents);
            console.log(data.documents);

        })

        database.listDocuments('67c9ffd9003d68236514', '67c9ffdd0039c4e09c9a').then((data) => {
            setCategories(data.documents);
            console.log(data.documents);
        }).catch((error) => {
            console.log('error getting categories', error);
        });

        database.listDocuments('67c9ffd9003d68236514', '67c9ffe6001c17071bb7').then((data) => {
            setItems(data.documents);
            console.log(data.documents);
        }).catch((error) => {
            console.log('error getting items', error);
        });

        client.subscribe.bind(client)([
            "databases.67c9ffd9003d68236514.collections.67c9ffe6001c17071bb7.documents",
        ], async () => {
            let data = await database.listDocuments('67c9ffd9003d68236514', '67c9ffe6001c17071bb7')
            setItems(data.documents);
            console.log(data.documents);

        })

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hour = new Date().getHours();
    const alcoholEnabled = (hour >= 15 || hour < 2);

    return (
        <content onClick={() => document.documentElement.requestFullscreen()}>
            <video
                className="bar-background-video"
                src="background.webm"
                autoPlay={true}
                loop={true}
                muted={true}
                playbackRate={0.5}
            />
            <Header />
            <main>
                {categories.filter((cat) => !cat.alcohol || alcoholEnabled).map((section) => (
                    <section className="bar-section">
                        <hr style={{ width: '50%' }} />
                        <h2 className="bar-section-title">{section.name === '🚫 Non-Alcoholic' && !alcoholEnabled ? '🥤 Beverages' : section.name}</h2>
                        <div className="bar-section-grid">
                            {
                                // items.filter((item) => item.category === section.id)
                                //     .map((item) => BarItem(item))
                                items.filter((item) => item.categories.$id === section.$id && item.shown)
                                    .map((item) => BarItem(item))

                            }
                        </div>
                    </section>
                ))}
            </main>
            <hr />
            <Footer />
        </content>
    );
}
