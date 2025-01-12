import React from 'react';

import BarItem from './components/BarItem';
import Footer from './components/Footer';
import Header from './components/Header';

import categories from './data/categories.json';
import items from './data/items.json';


export default function App() {

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
