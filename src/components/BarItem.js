import React from 'react';
import SkullSpaceMemberLogo from './SkullSpaceMemberLogo';

const CAD = new Intl.NumberFormat('en-ca', {
    style: 'currency',
    currency: 'CAD'
});



export default function BarItem({ name, image, size, price }) {
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
