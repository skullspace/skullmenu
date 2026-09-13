import React, { useEffect, useMemo } from 'react';
import './theme.css';
import { useAppwrite, ACTIVE_EVENT_UNAVAILABLE } from './API/api';
import { isAlcoholVisible } from './utils/barHours';
import { buildDoublePriceIndex, resolveDoublePrice } from './utils/doublePrice';
import { categoryColumnTitle } from './utils/categoryLayout';

import BarItem from './components/BarItem';
import CategoryIcon from './components/CategoryIcon';
import Footer from './components/Footer';
import Grain from './components/Grain';
import Header from './components/Header';

export default function App() {
    const { categories, items, settings, activeEvent, activeEventState } =
        useAppwrite();

    // "We could not check" is not the same claim as "the bar is closed", and the board is the only
    // place either one is ever said out loud -- the console.error behind this lives on a device
    // nobody is looking at. When the active-event lookup fails, alcohol still hides (fail closed),
    // but the header says so and a banner tells the room to ask staff instead of leaving them to
    // read a confident "Bar Closed" off a broken gate.
    const activeEventUnavailable =
        activeEventState?.status === ACTIVE_EVENT_UNAVAILABLE;

    // Re-derive once a minute so the bar-hours schedule crosses over on its own, without
    // waiting on a data change/reload.
    const [tick, setTick] = React.useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    // Same gate as the staff POS's own pos.js: the admin app's alcohol_override_disabled kill
    // switch, then the active event's sellsAlcohol/bar-hours window -- so this menu board and
    // the POS always agree on whether alcohol is on sale right now, both driven by the same
    // event/config data instead of a separate static bar_start/bar_end schedule. Every
    // "don't know" on either half (config not loaded, event unreadable, unparseable window)
    // hides alcohol; see isAlcoholVisible.
    const alcoholEnabled = useMemo(
        () => isAlcoholVisible(activeEvent, settings, new Date()),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeEvent, settings, tick]
    );

    useEffect(() => {
        document.documentElement.classList.add('dark');
    }, []);

    // The "<name> DBL" rows are dropped from the grid below, but they are what the register
    // actually charges for a double -- so they, not the single row's free-text dbl_price, are
    // where the posted double price comes from. See utils/doublePrice.js (P1-12).
    const doublePriceIndex = useMemo(
        () => buildDoublePriceIndex(items),
        [items]
    );

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
            <Header
                alcoholEnabled={alcoholEnabled}
                barClosesAt={activeEvent?.barClosesAt}
                activeEventUnavailable={activeEventUnavailable}
            />
            {activeEventUnavailable && (
                <div className="bar-alert" role="alert">
                    Bar status can’t be checked right now — alcohol is hidden
                    until it can. Ask staff.
                </div>
            )}
            <main className="bar-columns">
                {visibleSections.map(({ section, visibleItems }) => (
                    <div className="bar-column" key={section.$id}>
                        <div className="bar-col-header">
                            <div className="bar-col-icon">
                                <CategoryIcon name={section.name} />
                            </div>
                            {/* "Beverages" while the bar is shut, otherwise the category
                                name with its emoji prefix dropped -- CategoryIcon already
                                draws a matching vector icon beside it. Both decisions are
                                made on a normalised name in utils/categoryLayout (P2-31),
                                so a rename in the admin app cannot silently change the
                                heading rule. */}
                            <h2 className="bar-col-title">
                                {categoryColumnTitle(
                                    section.name,
                                    alcoholEnabled
                                )}
                            </h2>
                        </div>
                        <div className={rowsClassName}>
                            {visibleItems.map((item) => (
                                <BarItem
                                    key={item.$id}
                                    {...item}
                                    dbl_price={resolveDoublePrice(
                                        item,
                                        doublePriceIndex
                                    )}
                                    category={section.name}
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
