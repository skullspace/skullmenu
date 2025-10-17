import React from 'react';
import { useAppwrite } from './API/api';

import BarItem from './components/BarItem';
import Footer from './components/Footer';
import Header from './components/Header';

export default function App() {
    const { categories, items, settings } = useAppwrite();
    const hour = new Date().getHours();

    const [rawStart, rawEnd] = settings ? [settings.bar_start, settings.bar_end] : [15, 2];
    const alcoholStart = Number(rawStart ?? 15);
    const alcoholEnd = Number(rawEnd ?? 2);

    const normHour = (h) => (((Number(h) || 0) % 24) + 24) % 24;
    const s = normHour(alcoholStart);
    const e = normHour(alcoholEnd);

    const alcoholEnabled = s <= e ? (hour >= s && hour < e) : (hour >= s || hour < e);

    console.log(categories, items, settings, alcoholEnabled);

    return (
        <div id='menu' onClick={() => document.documentElement.requestFullscreen()}>
            < video
                className="bar-background-video"
                src="background.webm"
                autoPlay={true}
                loop={true}
                muted={true}
            />
            <Header />
            <main>
                {categories.filter((cat) => !cat.alcohol || alcoholEnabled).map((section) => (
                    <section className="bar-section">
                        <hr style={{ width: '50%' }} />
                        <h2 className="bar-section-title">{section.name === '🚫 Non-Alcoholic' && !alcoholEnabled ? 'Beverages' : section.name}</h2>
                        <div className="bar-section-grid">
                            {
                                // items.filter((item) => item.category === section.id)
                                //     .map((item) => BarItem(item))
                                items.filter((item) => item.categories.$id === section.$id && item.shown)
                                    .map((item) => <BarItem key={item.$id} {...item} />)
                            }
                        </div>
                    </section>
                ))}
            </main>
            <hr />
            <Footer />
        </div>
    );
}
