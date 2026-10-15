'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../common/Icons';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';

export function MobileAppNav() {
  const pathname = usePathname();
  const { count: cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();

  const isHome = pathname === '/';
  const isShop = pathname.startsWith('/shop');
  const isWishlist = pathname.startsWith('/wishlist');
  const isAccount = pathname.startsWith('/account');

  return (
    <nav className="mobile-app-bar" aria-label="Mobile app navigation">
      <Link href="/" className={`mobile-app-bar__item ${isHome ? 'is-active' : ''}`}>
        <span className="mobile-app-bar__icon"><Icon name="home" /></span>
        <span className="mobile-app-bar__label">Home</span>
      </Link>

      <Link href="/shop" className={`mobile-app-bar__item ${isShop ? 'is-active' : ''}`}>
        <span className="mobile-app-bar__icon"><Icon name="grid" /></span>
        <span className="mobile-app-bar__label">Shop</span>
      </Link>

      <Link href="/wishlist" className={`mobile-app-bar__item ${isWishlist ? 'is-active' : ''}`}>
        <span className="mobile-app-bar__icon">
          <Icon name="heart" />
          {wishlistCount > 0 && <span className="mobile-app-bar__badge">{wishlistCount}</span>}
        </span>
        <span className="mobile-app-bar__label">Saved</span>
      </Link>

      <button
        type="button"
        className="mobile-app-bar__item"
        onClick={openCart}
      >
        <span className="mobile-app-bar__icon">
          <Icon name="bag" />
          <span className="mobile-app-bar__badge">{cartCount}</span>
        </span>
        <span className="mobile-app-bar__label">Bag</span>
      </button>

      <Link href="/account" className={`mobile-app-bar__item ${isAccount ? 'is-active' : ''}`}>
        <span className="mobile-app-bar__icon"><Icon name="user" /></span>
        <span className="mobile-app-bar__label">Account</span>
      </Link>
    </nav>
  );
}

