import React from 'react';
import SkullSpaceMemberLogo from './SkullSpaceMemberLogo';
import { useAppwrite } from '../API/api';

const CAD = new Intl.NumberFormat('en-ca', {
    style: 'currency',
    currency: 'CAD'
});

const imgurl = (file) => {
    return `https://api.cloud.shotty.tech/v1/storage/buckets/67ca0bcc002993f0ef2f/files/${file}/view?project=67c9ff7a0013c21e2b40`;
}

export default function BarItem({ name, image, size, price, canadian, alcohol, alcoholic, selfcheck_price }) {
    const { settings } = useAppwrite();
    const textStyle = image ? { flex: 1 } : {};

    // determine whether alcohol sales are currently enabled (handles wrap-around ranges)
    const [rawStart, rawEnd] = settings ? [settings.bar_start, settings.bar_end] : [15, 2];
    const alcoholStart = Number(rawStart ?? 15);
    const alcoholEnd = Number(rawEnd ?? 2);
    const hour = new Date().getHours();
    const normHour = (h) => (((Number(h) || 0) % 24) + 24) % 24;
    const s = normHour(alcoholStart);
    const e = normHour(alcoholEnd);
    const alcoholEnabled = s <= e ? (hour >= s && hour < e) : (hour >= s || hour < e);

    return (
        <div
            className="bar-item"
            style={{ justifyContent: image ? 'left' : 'center' }}
        >
            {image ? (
                <div className="bar-item-logo">
                    <img src={imgurl(image)} alt="" />
                    {(canadian === 'true') && (
                        <img
                            className="canadian"
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Maple_Leaf.svg/900px-Maple_Leaf.svg.png?20190127193104"
                            alt="Canadian Flag"
                        />
                    )}
                </div>
            ) : ('')}
            <div style={textStyle}>
                <h4 className="bar-item-title">
                    {name}
                </h4>{size ? <><span className="bar-item-size"><i>{size}mL</i></span> <br /></> : <></>}
                <span className="bar-item-price">
                    {alcoholEnabled ? CAD.format(price / 100) : CAD.format((selfcheck_price || price) / 100)}
                    {
                        alcoholEnabled && settings?.member_discount ? (
                            <>(
                                <SkullSpaceMemberLogo />
                                {CAD.format(((price / 100) * (1 - (Number(settings?.member_discount ?? 0) / 100))))})
                            </>
                        ) : null
                    }
                </span>
            </div>
        </div>
    );
}
