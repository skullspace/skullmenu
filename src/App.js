const CAD = new Intl.NumberFormat('en-ca', {
    style: 'currency',
    currency: 'CAD'
});

function SkullSpaceMemberLogo() {
    return (
        <img
            className="bar-item-skull"
            src="skullspace-round.svg"
            alt="SkullSpace member logo"
        />
    );
}

function BarItem({ name, image, size, price }) {
    const textStyle = image ? { flex: 1 } : {};

    return (
        <div
            className="bar-item"
            style={{ justifyContent: image ? 'left' : 'center' }}
        >
            {image ? (
                <div className="bar-item-logo">
                    <img src={image} alt="" />
                </div>
            ) : (
                ''
            )}
            <div style={textStyle}>
                <h4 className="bar-item-title">
                    {name} {size ? <i>{size}mL</i> : ''}
                </h4>
                <span className="bar-item-price">
                    {CAD.format(price / 100)} (
                    <SkullSpaceMemberLogo />
                    {CAD.format(price / 100 / 2)})
                </span>
            </div>
        </div>
    );
}

function App() {
    const sections = [
        {
            name: '🍺 Beers',
            items: [
                {
                    name: 'Coors',
                    image: 'coors.svg',
                    size: 355,
                    price: 800
                },
                {
                    name: 'Coors Light',
                    image: 'coors-light.svg',
                    size: 355,
                    price: 800
                },
                {
                    name: 'Pabst Blue Ribbon',
                    image: 'pbr.svg',
                    size: 355,
                    price: 800
                },
                {
                    name: 'Half Pints St. James Pale Ale',
                    image: 'half-pints.png',
                    size: 473,
                    price: 1000
                },
                {
                    name: 'Kilter Juicii',
                    image: 'kilter.png',
                    size: 473,
                    price: 1000
                },
            ]
        },
        {
            name: '🌊 Seltzers',
            items: [
                {
                    name: 'White Claw Black Cherry',
                    image: 'white-claw-black-cherry.png',
                    size: 355,
                    price: 900
                },
                {
                    name: 'White Claw Watermelon',
                    image: 'white-claw-watermelon.png',
                    size: 355,
                    price: 900
                },
                {
                    name: 'White Claw Natural Lime',
                    image: 'white-claw-lime.png',
                    size: 355,
                    price: 900
                },
                {
                    name: 'White Claw Mango',
                    image: 'white-claw-mango.png',
                    size: 355,
                    price: 900
                },
                {
                    name: 'White Claw Ruby Grapefruit',
                    image: 'white-claw-grapefruit.png',
                    size: 355,
                    price: 900
                }
            ]
        },
        {
            name: '🥃 Mixed Drinks/Shots',
            items: [
                { name: 'Single', size: 40, price: 900 },
                { name: 'Double', size: 80, price: 1600 }
            ],
            hack: true
        },
        {
            name: 'Food',
            items: [
                { name: 'Pizza', price: 300 },
                { name: 'Pizza 2 Slice', price: 500 },

            ],
            hack: true
        },
        {
            name: '🚫 Non-Alcoholic',
            items: [
                {
                    name: 'Soda / Water',
                    image: 'coke.svg',
                    price: 300
                },
                {
                    name: 'Olé Mocktails',
                    image: 'ole.png',
                    price: 800
                },
                {
                    name: 'Red Bull',
                    image: 'redbull.webp',
                    price: 600
                },
                {
                    name: 'Red Bull Zero Sugar',
                    image: 'redbull-zero.png',
                    price: 600
                }
            ]
        }
    ];

    return (
        <content  onClick={() => document.documentElement.requestFullscreen()}>
            <video
                className="bar-background-video"
                src="background.mp4"
                autoPlay={true}
                loop={true}
                muted={true}
            />

            <header className="bar-header">
                <img
                    className="bar-logo"
                    src="skullspace.svg"
                    alt="SkullSpace logo"
                />
                <h2 className="bar-subtitle">Bar Menu</h2>
            </header>
            <main>
                {sections.map((section) => (
                    <section className="bar-section">
                        <hr style={{ width: '50%' }} />
                    <h2 className="bar-section-title">{section.name}</h2>
                    <div className="bar-section-grid">
                        {section.items.map((item) => BarItem(item))}
                        </div>

                </section>
            ))}
            </main>

            <hr />

            <footer className="bar-footer">
                <em>
                    <SkullSpaceMemberLogo />
                    SkullSpace members receieve a <strong>50% discount</strong>.
                </em>
            </footer>
        </content>
    );
}

export default App;
