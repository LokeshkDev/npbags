/**
 * NP Grand Shopping — Interactive Storefront Controller
 * Handles hero indicators, cart increment, wishlist state, drawer & newsletter
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Hero Multi-Slide Carousel Controller
  const slider = document.getElementById('heroSlider');
  const slides = document.querySelectorAll('.hero-slider__slide');
  const dots = document.querySelectorAll('.hero-slider__dot');
  const prevBtn = document.getElementById('heroPrev');
  const nextBtn = document.getElementById('heroNext');

  let currentSlide = 0;
  let autoTimer = null;

  function showSlide(index) {
    if (slides.length === 0) return;
    currentSlide = (index + slides.length) % slides.length;

    slides.forEach((slide, idx) => {
      slide.classList.toggle('is-active', idx === currentSlide);
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle('is-active', idx === currentSlide);
    });
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    showSlide(currentSlide - 1);
  }

  function startTimer() {
    stopTimer();
    autoTimer = setInterval(nextSlide, 5000);
  }

  function stopTimer() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      showSlide(idx);
      startTimer();
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      startTimer();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      startTimer();
    });
  }

  // Hero Drag & Swipe (Mouse + Touch)
  if (slider) {
    let startX = 0;
    let endX = 0;
    let isDragging = false;

    slider.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.pageX;
      stopTimer();
    });

    slider.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      endX = e.pageX;
      const diff = endX - startX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) {
          prevSlide();
        } else {
          nextSlide();
        }
      }
      startTimer();
    });

    slider.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        startTimer();
      }
    });

    slider.addEventListener('touchstart', (e) => {
      startX = e.touches[0].pageX;
      stopTimer();
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].pageX;
      const diff = endX - startX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) {
          prevSlide();
        } else {
          nextSlide();
        }
      }
      startTimer();
    }, { passive: true });
  }

  startTimer();

  // Category Drag & Swipe for Desktop and Mobile
  const catCarousel = document.querySelector('.categories-carousel');
  if (catCarousel) {
    let isCatDown = false;
    let catStartX = 0;
    let catScrollLeft = 0;

    catCarousel.addEventListener('mousedown', (e) => {
      isCatDown = true;
      catStartX = e.pageX - catCarousel.offsetLeft;
      catScrollLeft = catCarousel.scrollLeft;
      catCarousel.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isCatDown) return;
      e.preventDefault();
      const x = e.pageX - catCarousel.offsetLeft;
      const walk = (x - catStartX) * 1.4;
      catCarousel.scrollLeft = catScrollLeft - walk;
    });

    window.addEventListener('mouseup', () => {
      if (!isCatDown) return;
      isCatDown = false;
      catCarousel.style.cursor = 'grab';
    });
  }

  // 2. Wishlist Toggle & Counter
  let wishlistCount = 0;
  const wishlistCountEl = document.getElementById('wishlistCount');
  const wishlistButtons = document.querySelectorAll('.product-card .wishlist-btn');

  wishlistButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isFavorited = btn.classList.toggle('is-favorited');
      wishlistCount += isFavorited ? 1 : -1;
      if (wishlistCount < 0) wishlistCount = 0;
      if (wishlistCountEl) {
        wishlistCountEl.textContent = wishlistCount;
      }
    });
  });

  // 3. Add to Cart & Cart Drawer
  let cartCount = 0;
  const cartCountEl = document.getElementById('cartCount');
  const cartButtons = document.querySelectorAll('.product-card .add-cart-btn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const cartTriggerBtn = document.getElementById('cartTriggerBtn');

  function openCart() {
    if (cartDrawer) {
      cartDrawer.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCart() {
    if (cartDrawer) {
      cartDrawer.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  cartButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      cartCount += 1;
      if (cartCountEl) {
        cartCountEl.textContent = cartCount;
      }
      openCart();
    });
  });

  if (cartCloseBtn) {
    cartCloseBtn.addEventListener('click', closeCart);
  }

  if (cartTriggerBtn) {
    cartTriggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCart();
    });
  }

  // Close drawer on background click
  if (cartDrawer) {
    cartDrawer.addEventListener('click', (e) => {
      if (e.target === cartDrawer) {
        closeCart();
      }
    });
  }

  // 4. Newsletter Subscription Feedback
  const newsletterForm = document.querySelector('.newsletter-form');
  const newsletterAlert = document.querySelector('.newsletter-alert');

  if (newsletterForm && newsletterAlert) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector('.newsletter-input');
      if (input && input.value) {
        newsletterAlert.textContent = `✓ Thank you! ${input.value} is now subscribed.`;
        newsletterAlert.style.display = 'block';
        input.value = '';
        setTimeout(() => {
          newsletterAlert.style.display = 'none';
        }, 4000);
      }
    });
  }

  // 5. Mobile Menu Drawer Toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const primaryNav = document.querySelector('.primary-nav');

  if (mobileMenuBtn && primaryNav) {
    mobileMenuBtn.addEventListener('click', () => {
      const isVisible = primaryNav.style.display === 'block';
      primaryNav.style.display = isVisible ? 'none' : 'block';
    });
  }

  // 6. Mobile Footer Accordion Toggles
  const footerAccBtns = document.querySelectorAll('.footer-accordion-btn');
  footerAccBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.footer-col--accordion');
      if (!parent) return;
      const content = parent.querySelector('.footer-accordion-content');
      if (!content) return;
      const isOpen = btn.classList.contains('is-open');
      btn.classList.toggle('is-open', !isOpen);
      content.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', !isOpen);
    });
  });
});
