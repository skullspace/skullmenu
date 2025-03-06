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


    useEffect(() => {
        client.setEndpoint('https://api.cloud.shotty.tech/v1').setProject('67c9ff7a0013c21e2b40');

        const account = new Account(client);
        const promise = account.createAnonymousSession();

        promise.then(function (response) {
            console.log(response); // Success
        }, function (error) {
            console.log(error); // Failure
        });

        // Init database
        const database = new Databases(client);

        // db id 67c9ffd9003d68236514
        // items collection id 67c9ffe6001c17071bb7
        // category collection id 67c9ffdd0039c4e09c9a


        client.subscribe.bind(client)([
            "databases.67c9ffd9003d68236514.collections.67c9ffe6001c17071bb7.documents",
        ], database.listDocuments('67c9ffd9003d68236514', '67c9ffe6001c17071bb7').then((response) => {
            setItems(response.documents);
            console.log(response.documents);
        }));


        client.subscribe.bind(client)([
            "databases.67c9ffd9003d68236514.collections.67c9ffdd0039c4e09c9a.documents",
        ], database.listDocuments('67c9ffd9003d68236514', '67c9ffdd0039c4e09c9a').then((response) => {
            setCategories(response.documents);
            console.log(response.documents);
        }));


        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);







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
                                // items.filter((item) => item.category === section.id)
                                //     .map((item) => BarItem(item))
                                items.filter((item) => item.categories.$id === section.$id)
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
