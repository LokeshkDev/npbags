# Native storefront starter

A responsive, high-performance storefront built with native HTML5, CSS3 and vanilla JavaScript. Reusable page sections are implemented as browser-native Web Components in `js/components.js`.

## Features

- **Banner Section Carousel**:
  - Multi-slide carousel within the brand identity and design language.
  - Reduced height so the Trust Strip and Collections naturally peek above the fold.
  - Dynamic fluid text flow animations on slider transitions with staggered typographic entrances.
  - Controls include previous/next arrows, active indicator pills, touch swipe support, and auto-play with hover pause.
- **Marquee Announcement Bar on Mobile**:
  - Seamless, continuous ticker animation with touch-to-pause functionality.
- **Scroll Fade-in Animations**:
  - IntersectionObserver reveals sections and cascades grid items smoothly as the user scrolls down the page.
- **Mobile View Like a Mobile App**:
  - Dedicated fixed bottom app navigation bar (Home, Shop, Saved Wishlist, Bag with real-time counter, Account).
  - App-style sticky header with quick actions.
  - Mobile bottom sheets for Quick View modals with swipe-drag handles.
  - Safe-area bottom padding to ensure no content is obscured.
- **Mobile Footer Accordion**:
  - On mobile screens, footer link columns (Explore, Help & Support, Stay Connected) convert into an accordion that is **always collapsed by default**.
  - Tapping each section header smoothly expands or collapses the section with interactive `+` / `−` indicators.
- **Shop / Collections Page (`collections.html` / `shop.html`)**:
  - **Left Column**: Filter & Sort sidebar (category filter with counts, price range chips, availability, color swatches, and sort dropdown). On mobile, slides up as an app-style bottom sheet drawer.
  - **Right Column**: Product catalog with active filter tags and **Grid Level Switcher**:
    - `3` — 3-column spacious grid
    - `4` — 4-column balanced grid (default desktop)
    - `6` — 6-column compact high-density grid
    - `table` — Full table list format with product thumbnail, details, rating, price, stock status, quick view, and Add to Bag buttons.
- **Product Card Quick View Popup**:
  - Quick view button placed alongside the favourite wishlist heart.
  - Desktop: Centered modal with glassmorphism backdrop blur, image thumbnail switcher, color and size selectors, quantity stepper, and "Add to Bag".
  - Mobile: Native-feeling bottom sheet with touch-friendly layout and direct action buttons.
- **Dedicated Product Detail Page (PDP)**:
  - Accessible via `product.html?id=<productId>` for every product in the catalog.
  - Interactive photo gallery with main zoomable preview and thumbnail selector.
  - Color swatches that switch active images and color titles.
  - Size and capacity selectors with real-time stock indicator.
  - Quantity picker, "Add to Bag", instant "Buy Now", and Wishlist toggle.
  - Value proposition strip (Free shipping over ₹499, 30-day returns, 2-year warranty).
  - Accordion / tabbed sections: Features & Dimensions, Sustainable Materials & Care, Delivery & Returns, and Customer Reviews with star breakdown.
  - "You May Also Like" related product recommendations.
  - Mobile sticky bottom purchase bar for quick 1-thumb purchasing on phones.
- **Indian Rupee (₹) Pricing & Currency**:
  - All prices, strike-through sale prices, delivery thresholds, and cart totals rendered in `₹`.
- **Persistent Shopping Cart**:
  - Synchronized via `localStorage` across the homepage, collections page, quick view popups, and the PDP.

## Run locally

Open `index.html`, `collections.html`, or `product.html` directly in any web browser, or serve with a local server:

```bash
# Using Node.js
npx serve .
# or
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Design System Tokens
- Body font: DM Sans (400/500/600/700)
- Heading font: Anybody (500/600/700)
- Brand red: `#ED1C2A`
- Brand green: `#08A653`
- Currency: `₹` (Indian Rupee)
- Ink: `#222222`
- Warm surface: `#FAF7F2`

## Files
- `index.html` — Homepage composition
- `collections.html` / `shop.html` — Collections page with filter/sort & grid switcher (3, 4, 6, table)
- `product.html` — Dynamic Product Detail Page (PDP)
- `css/tokens.css` — Design tokens and brand palette
- `css/global.css` — Global typography, scroll animations, mobile app layout
- `css/components.css` — Carousel, Quick View modal, cards, mobile app bar, and footer accordion
- `css/pdp.css` — Product detail page layouts, gallery, tabs, and sticky buy bar
- `css/shop.css` — Shop page layouts, filter sidebar, grid levels (3, 4, 6), and table format
- `js/products.js` — Shared product catalog data with variants, dimensions, and reviews
- `js/components.js` — Reusable Web Components (Hero Carousel, Quick View Modal, Mobile App Nav, Collapsible Footer, etc.)
- `js/app.js` — Global cart management, Quick View popup controller, scroll observer
- `js/shop.js` — Collections page controller for filtering, sorting, and grid level switching
- `js/pdp.js` — PDP controller for URL params, gallery switcher, variant logic, and tabs
- `assets/brand-logo.png` — Brand logo asset
