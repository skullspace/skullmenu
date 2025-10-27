import React, { useEffect } from 'react';
import './theme.css';
import { useAppwrite } from './API/api';

import BarItem from './components/BarItem';
import Footer from './components/Footer';
import Header from './components/Header';

export default function App() {
    const { categories, items, settings } = useAppwrite();
    const hour = new Date().getHours();

    const [rawStart, rawEnd] = settings
        ? [settings.bar_start, settings.bar_end]
        : [15, 2];
    const alcoholStart = Number(rawStart ?? 15);
    const alcoholEnd = Number(rawEnd ?? 2);

    const normHour = (h) => (((Number(h) || 0) % 24) + 24) % 24;
    const s = normHour(alcoholStart);
    const e = normHour(alcoholEnd);

    const alcoholEnabled =
        s <= e ? hour >= s && hour < e : hour >= s || hour < e;

    useEffect(() => {
        const html = document.documentElement;
        if (alcoholEnabled) html.classList.add('dark');
        else html.classList.remove('dark');

        // optional: set data-theme attribute for debugging / CSS selectors
        html.setAttribute('data-theme', alcoholEnabled ? 'dark' : 'light');
    }, [alcoholEnabled]);

    return (
        <div
            id="menu"
            onClick={() => document.documentElement.requestFullscreen()}
        >
            {alcoholEnabled && (
                <video
                    className="bar-background-video"
                    src="background.webm"
                    autoPlay={true}
                    loop={true}
                    muted={true}
                />
            )}
            <Header settings={settings} />
            <main>
                {categories
                    .filter((cat) => !cat.alcohol || alcoholEnabled)
                    .map((section) => {
                        const visibleItems = items.filter(
                            (item) =>
                                item.categories?.$id === section.$id &&
                                item.shown
                        );
                        if (!visibleItems || visibleItems.length === 0)
                            return null;

                        return (
                            <section key={section.$id} className="bar-section">
                                <hr style={{ width: '50%' }} />
                                <h2 className="bar-section-title">
                                    {section.name === '🚫 Non-Alcoholic' &&
                                    !alcoholEnabled
                                        ? 'Beverages'
                                        : section.name}
                                </h2>
                                <div className="bar-section-grid">
                                    {visibleItems.map((item) => (
                                        <BarItem
                                            settings={settings}
                                            key={item.$id}
                                            {...item}
                                            category={section.name}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
            </main>
            <hr />
            <Footer settings={settings} />
        </div>
    );
}
