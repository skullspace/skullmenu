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

export default function BarItem({ name, image, size, price, canadian }) {
    const { settings } = useAppwrite();
    const textStyle = image ? { flex: 1 } : {};
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
                    {CAD.format(price / 100)} (
                    <SkullSpaceMemberLogo />
                    {CAD.format((price / 100) * (1 - (settings?.member_discount / 100)) || 1)})
                </span>
            </div>
        </div>
    );
}
