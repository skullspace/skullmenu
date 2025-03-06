import React from 'react';
// import appwrite
import { Client as Appwrite, Databases, Account, Query } from 'appwrite';

import BarItem from './components/BarItem';
import Footer from './components/Footer';
import Header from './components/Header';


export default function App() {

    // Init appwrite
    const client = new Appwrite.Client({
        endpoint: "https://api.cloud.shotty.tech/v1",
        project: "67c9ff7a0013c21e2b40",
    });

    // Init database
    const database = new client.Database(client);

    // db id 67c9ffd9003d68236514
    // items collection id 67c9ffe6001c17071bb7
    // category collection id 67c9ffdd0039c4e09c9a
    const categories = [];
    const items = [];

    const itemsSubscription = database.subscribe([
        "databases.67c9ffd9003d68236514.collections.67c9ffe6001c17071bb7.documents",
    ]);
    const categoriesSubscription = database.subscribe([
        "databases.67c9ffd9003d68236514.collections.67c9ffdd0039c4e09c9a.documents",
    ]);

    categoriesSubscription.then(() => {
        database.listDocuments('67c9ffdd0039c4e09c9a').then((response) => {
            categories.length = 0;
            response.documents.forEach((category) => {
                categories.push(category);
            });
        });
    });
    itemsSubscription.then(() => {
        database.listDocuments('67c9ffe6001c17071bb7').then((response) => {
            items.length = 0;
            response.documents.forEach((item) => {
                items.push(item);
            });
        });
    });



    return (
        <content onClick={() => document.documentElement.requestFullscreen()}>
            <video
                className="bar-background-video"
                src="background.webm"
                autoPlay={true}
                loop={true}
                muted={true}
            />

            <Header />

            <main>
                {categories.map((section) => (
                    <section className="bar-section">
                        <hr style={{ width: '50%' }} />
                        <h2 className="bar-section-title">{section.name}</h2>
                        <div className="bar-section-grid">
                            {
                                items.filter((item) => item.category === section.id)
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
