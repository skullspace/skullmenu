import CategoryIcon from './CategoryIcon';
import {
    isFoodCategory,
    isMixedDrinksCategory
} from '../utils/categoryLayout';

const CAD = new Intl.NumberFormat('en-ca', {
    style: 'currency',
    currency: 'CAD'
});

// The maple leaf from the Canadian flag (public domain), recolored to
// currentColor so it follows the app's accent color.
function CanadianLeaf() {
    return (
        <svg viewBox="-2015 -2000 4030 4030" fill="currentColor">
            <path d="m-90 2030 45-863a95 95 0 0 0-111-98l-859 151 116-320a65 65 0 0 0-20-73l-941-762 212-99a65 65 0 0 0 34-79l-186-572 542 115a65 65 0 0 0 73-38l105-247 423 454a65 65 0 0 0 111-57l-204-1052 327 189a65 65 0 0 0 91-27l332-652 332 652a65 65 0 0 0 91 27l327-189-204 1052a65 65 0 0 0 111 57l423-454 105 247a65 65 0 0 0 73 38l542-115-186 572a65 65 0 0 0 34 79l212 99-941 762a65 65 0 0 0-20 73l116 320-859-151a95 95 0 0 0-111 98l45 863z" />
        </svg>
    );
}

export default function BarItem({
    name,
    menu_name,
    image,
    size,
    price,
    canadian,
    category,
    dbl_price
}) {
    // P2-31: matched on the normalised category name, not on the exact emoji-prefixed string --
    // renaming the category in the admin app must not silently switch the double price off.
    const mixed = isMixedDrinksCategory(category);
    const food = isFoodCategory(category);
    const showPriceStack = mixed || (food && dbl_price);

    return (
        <div className="bar-row">
            <div className="bar-thumb">
                {image ? (
                    <img src={image} alt="" />
                ) : (
                    <CategoryIcon name={category} />
                )}
            </div>
            <div className="bar-row-text">
                <div className="bar-row-name">
                    {menu_name || name}
                    {canadian === true && <CanadianLeaf />}
                </div>
                {size && !food ? <div className="bar-row-size">{size} mL</div> : null}
            </div>
            {showPriceStack ? (
                <div className="bar-row-price-stack">
                    {food ? (
                        <>
                            <div className="line">
                                1 Slice <b>{CAD.format(price / 100)}</b>
                            </div>
                            <div className="line">
                                2 Slices <b>{CAD.format(dbl_price / 100)}</b>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="line">
                                Single <b>{CAD.format(price / 100)}</b>
                            </div>
                            <div className="line">
                                Double <b>{CAD.format(dbl_price / 100)}</b>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                // P2-30: `price` is `sale_price`, the only number the register ever charges.
                // This used to post `selfcheck_price` (pos_items.self_pricing) whenever alcohol
                // was off -- a field nothing in the POS or any function reads, whose only writer
                // is the admin app's item form. An operator setting a "kiosk price" there had no
                // reason to expect a customer-facing effect, but the board would advertise it
                // while the till rang sale_price. If a separate kiosk price is ever wanted it
                // belongs on its own labelled line, not silently in place of the real one.
                <div className="bar-row-price">{CAD.format(price / 100)}</div>
            )}
        </div>
    );
}
