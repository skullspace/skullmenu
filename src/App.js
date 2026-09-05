import React, { useEffect, useMemo } from 'react';
import './theme.css';
import { useAppwrite } from './API/api';

import BarItem from './components/BarItem';
import CategoryIcon from './components/CategoryIcon';
import Footer from './components/Footer';
import Grain from './components/Grain';
import Header from './components/Header';

export default function App() {
    const { categories, items, settings } = useAppwrite();

    const [rawStart, rawEnd] = settings
        ? [settings.bar_start, settings.bar_end]
        : [15, 2];
    const alcoholStart = Number(rawStart ?? 15);
    const alcoholEnd = Number(rawEnd ?? 2);

    const normHour = (h) => (((Number(h) || 0) % 24) + 24) % 24;
    const s = normHour(alcoholStart);
    const e = normHour(alcoholEnd);

    // Staff can force alcohol off from the POS regardless of the scheduled
    // hours (e.g. running out, a licensing issue) -- it only ever suppresses,
    // never forces alcohol to show outside the configured hours.
    const alcoholManuallyDisabled =
        settings?.alcohol_disabled === true ||
        settings?.alcohol_disabled === 'true';

    // Re-derive on a once-a-minute tick (for the clock) and whenever the
    // manual override changes (which arrives instantly via realtime).
    const [tick, setTick] = React.useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    const alcoholEnabled = useMemo(() => {
        if (alcoholManuallyDisabled) return false;
        const currentHour = new Date().getHours();
        return s <= e
            ? currentHour >= s && currentHour < e
            : currentHour >= s || currentHour < e;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s, e, alcoholManuallyDisabled, tick]);

    useEffect(() => {
        document.documentElement.classList.add('dark');
    }, []);

    // Only categories that currently have at least one visible item get a
    // column -- an empty category (e.g. alcohol outside bar hours) is
    // dropped entirely rather than shown as a dead placeholder, so the
    // remaining categories' columns (flex: 1 each) grow to take its place.
    const visibleSections = useMemo(() => {
        return categories
            .filter((cat) => !cat.alcohol || alcoholEnabled)
            .map((section) => {
                const visibleItems = items.filter((item) => {
                    const itemCategoryId =
                        item.categories && typeof item.categories === 'object'
                            ? item.categories.$id
                            : item.categories;
                    if (itemCategoryId !== section.$id) return false;
                    if (!item.enabled_menu) return false;
                    // don't advertise something that can't actually be rung up
                    if (!item.enabled_pos) return false;

                    const displayName = item.name.toString().trim();
                    if (displayName.toUpperCase().endsWith('DBL'))
                        return false;

                    return true;
                });
                return { section, visibleItems };
            })
            .filter(({ visibleItems }) => visibleItems.length > 0);
    }, [categories, items, alcoholEnabled]);

    // With few enough categories on screen, each one has room to spread its
    // items into two balanced sub-columns instead of one long, sparse list.
    const rowsClassName =
        visibleSections.length > 0 && visibleSections.length <= 2
            ? 'bar-rows multi'
            : 'bar-rows';

    return (
        <div
            id="menu"
            onClick={() => document.documentElement.requestFullscreen()}
        >
            <Grain />
            <Header alcoholEnabled={alcoholEnabled} barEndHour={e} />
            <main className="bar-columns">
                {visibleSections.map(({ section, visibleItems }) => (
                    <div className="bar-column" key={section.$id}>
                        <div className="bar-col-header">
                            <div className="bar-col-icon">
                                <CategoryIcon name={section.name} />
                            </div>
                            <h2 className="bar-col-title">
                                {section.name === '🚫 Non-Alcoholic' &&
                                !alcoholEnabled
                                    ? 'Beverages'
                                    : // the emoji prefix on category names is
                                      // redundant now that CategoryIcon draws
                                      // a matching vector icon beside it
                                      section.name.replace(
                                          /^\p{Extended_Pictographic}\s*/u,
                                          ''
                                      )}
                            </h2>
                        </div>
                        <div className={rowsClassName}>
                            {visibleItems.map((item) => (
                                <BarItem
                                    key={item.$id}
                                    {...item}
                                    category={section.name}
                                    alcoholEnabled={alcoholEnabled}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </main>
            <Footer settings={settings} alcoholEnabled={alcoholEnabled} />
        </div>
    );
}
