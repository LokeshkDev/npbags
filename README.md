# NP Grand — Themed Full-Stack E-Commerce Platform

A production-ready full-stack e-commerce platform built from the native `themedesign/` theme design. Includes an Express/MySQL REST API with Multer image pipelines, a customer storefront in Next.js (App Router, JavaScript), and an admin dashboard featuring a full **CMS & Section Manager** and **Delivery Rules Engine**.

---

## Architecture Overview

```
NPGrand/
├── themedesign/               # Original HTML5/CSS/JS theme design (read-only reference)
├── client/
│   ├── website/              # Customer Storefront (Next.js, Port 3000)
│   │   ├── app/              # Routes: /, /shop, /product/[slug], /cart, /checkout, /account, /wishlist, /blog, /about, /contact, /order-success
│   │   ├── components/       # layout/, home/, product/, common/
│   │   ├── styles/           # Ported theme CSS (tokens.css, global.css, components.css, shop.css, pdp.css)
│   │   └── lib/              # api.js, cart-context.js, wishlist-context.js, quickview-context.js, auth-context.js
│   └── admin/                # Admin Panel (Next.js, Port 3001)
│       ├── app/              # /dashboard, /products, /categories, /orders, /cms/sections, /cms/delivery, /banners, /coupons, /blogs, /messages, /settings, /login
│       ├── components/       # Sidebar, Topbar, Modal, ImageUploader
│       └── lib/              # api.js, auth.js
└── server/                   # Express + MySQL + Multer API Server (Port 5000)
    ├── src/
    │   ├── config/           # db.js (mysql2/promise pool), env.js
    │   ├── middleware/       # auth.js (JWT), role.js, upload.js (Multer), error.js
    │   ├── controllers/      # auth, products, categories, orders, cms, banners, blogs, contact, settings
    │   ├── routes/           # REST endpoints
    │   └── scripts/          # setup-db.js, seed-db.js
    ├── uploads/              # Multer media storage (products/, banners/, blogs/, cms/)
    ├── db/                   # schema.sql, seed.sql
    ├── .env.example          # AWS Lightsail / MySQL configuration
    └── server.js
```

---

## 1. Quick Start Guide

### Step 1: Configure Database Environment
Edit `server/.env` (or copy from `server/.env.example`) to point to your MySQL server (e.g. AWS Lightsail MySQL instance):

```env
PORT=5000
NODE_ENV=development

# MySQL Database configuration (Points to AWS Lightsail MySQL or local MySQL)
DB_HOST=your-lightsail-ip-or-host
DB_PORT=3306
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=npgrand_store

# JWT Secret
JWT_SECRET=npgrand_super_secret_jwt_key_2026_production
JWT_EXPIRES_IN=7d

# CORS
CLIENT_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
BASE_URL=http://localhost:5000
```

### Step 2: Initialize Database Schema & Seed Catalog
From the `server/` directory, run the automated setup and seed scripts:

```bash
cd server
npm run db:setup    # Creates database and executes schema.sql
npm run db:seed     # Inserts demo products, categories, banners, reviews, admin user, and CMS defaults
```

> **Default Admin Credentials**:
> - Email: `admin@npgrand.com`
> - Password: `admin123`

---

## 2. Running the Applications

You can run services individually from their folders or using the root convenience scripts:

### Option A: From Project Root
```bash
# Start Backend API (Port 5000)
npm run dev:server

# Start Customer Storefront (Port 3000)
npm run dev:website

# Start Admin Dashboard (Port 3001)
npm run dev:admin
```

### Option B: Dedicated Terminals
Open three terminal windows:

#### Terminal 1: Backend API (Port 5000)
```bash
cd server
npm run dev
# API running at http://localhost:5000
```

#### Terminal 2: Customer Storefront (Port 3000)
```bash
cd client/website
npm run dev
# Storefront running at http://localhost:3000
```

#### Terminal 3: Admin Dashboard (Port 3001)
```bash
cd client/admin
npm run dev
# Admin dashboard running at http://localhost:3001
```

---

## 3. Key Storefront Features (1:1 Theme Port)

- **Homepage Section Order**:
  1. `SiteAnnouncement`: Marquee ticker powered by `/api/cms/sections/announcement`.
  2. `SiteHeader`: Brand logo, collections hover dropdown with counts and curated product card, search popover, cart counter, wishlist counter, account links, and mobile side drawer with nested accordions.
  3. `HeroBanner`: Slideshow carousel with fluid typography animations, auto-play with hover pause, touch swipe gestures on mobile, previous/next controls, and active indicator pills.
  4. `TrustStrip`: 4-column value proposition strip (free shipping, 30-day exchange, handcrafted quality, secure checkout).
  5. `CategorySection`: Visual cards for collections (Everyday bags, Work & travel, Weekend edit, New season).
  6. `ProductSection`: "New arrivals" carousel with desktop controls, touch drag, and responsive dots.
  7. `EditorialBanner`: Split storytelling section with high-resolution imagery and brand manifesto.
  8. `BenefitsSection`: 3-column feature highlights.
  9. `NewsletterSection`: Functional community subscription form connected to `/api/contact/newsletter`.
  10. `SiteFooter`: Footer columns with mobile accordion (+/- toggle), payment badges, copyright.
  11. `CartDrawer`: Slide-in cart panel with live quantity stepper, free shipping progress bar, promo code input, and checkout CTA.
  12. `QuickViewModal`: Glassmorphism centered modal on desktop / native swipe bottom sheet on mobile with gallery, size/color selectors, and Add to Bag.
  13. `MobileAppNav`: App-style sticky bottom navigation bar with live bag badge.
- **Shop / Collections Page (`/shop`)**:
  - Filter & Sort sidebar (categories, price range, availability, color swatches, sort select).
  - Active filter tags with single-click removal.
  - **Grid Level Switcher**: `3` (spacious), `4` (balanced default), `6` (compact density), and `table` (full product table view with direct quick view & add actions).
- **Dedicated Product Detail Page (`/product/[slug]`)**:
  - Zoomable image gallery with thumbnail switcher.
  - Color swatches updating the image and color title.
  - Size selectors with live in-stock badge.
  - Quantity picker, "Add to Bag", instant "Buy Now", and Wishlist heart.
  - Value proposition strip.
  - Accordion tabs: Features & Dimensions, Sustainable Materials & Care, Delivery & Returns, Customer Reviews with star breakdown.
  - Related product recommendations.
  - Mobile sticky bottom purchase bar.
- **Checkout & Order Flow (`/checkout` & `/order-success`)**:
  - Complete delivery address collection.
  - Coupon code validation (`WELCOME10`, `FREESHIP`).
  - Cash on delivery (COD) and Card/UPI payment options.
  - Instant order generation with order number receipt (`NP-YYYYMMDD-XXXX`).

---

## 4. Admin Panel Features

- **Dashboard (`/dashboard`)**: KPI metrics (Total Sales, Total Orders, Active Catalog, Low Stock Alert), Recent Orders, quick action shortcuts.
- **Products (`/products`)**: Add and edit products with Multer multi-image upload pipeline, pricing, sale discounts, category assignment, dimensions, materials, and variants.
- **Categories (`/categories`)**: Manage collections and display order.
- **Orders (`/orders`)**: Inspect customer shipping address, purchased items, and update order status (`pending` -> `paid` -> `shipped` -> `delivered` -> `cancelled`).
- **CMS & Sections Manager (`/cms/sections`)**: Live customization of every section on the customer homepage (Announcement ticker, Hero carousel slides, Trust strip badges, Category strip, Featured collection, Editorial banner, Benefits, Newsletter copy, and Section visibility toggles).
- **Delivery Rules Engine (`/cms/delivery`)**: Configure free delivery threshold (e.g. ₹499), standard shipping fee, express shipping fee, estimated delivery days, Cash-on-Delivery (COD) toggle, and return/exchange window.
- **Coupons (`/coupons`)**: Create percentage or fixed discount promo codes with minimum order amount restrictions.
- **Editorial (`/blogs`)**: Write and publish stories to the journal.
- **CRM & Inquiries (`/messages`)**: Review submitted contact inquiries and community subscribers.
- **Store Settings (`/settings`)**: Update store name, support email, phone hotline, and postal address.

