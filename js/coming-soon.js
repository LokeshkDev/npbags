/**
 * Logic & Interactive Animations for Coming Soon Page
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Kinetic Typography Character Stagger
  const animatedWords = document.querySelectorAll('.cs-word');
  let charGlobalIndex = 0;

  animatedWords.forEach((word) => {
    const text = word.textContent.trim();
    word.innerHTML = '';
    
    // Split each character into a span with delayed animation
    [...text].forEach((char) => {
      const span = document.createElement('span');
      span.className = 'cs-char';
      span.textContent = char;
      span.style.animationDelay = `${0.35 + charGlobalIndex * 0.05}s`;
      word.appendChild(span);
      charGlobalIndex++;
    });
  });

  // 2. Interactive Parallax Tilt on Product Cards
  const stage = document.querySelector('.cs-cards-stage');
  const cards = document.querySelectorAll('.cs-card');

  if (stage && window.matchMedia('(pointer: fine)').matches) {
    stage.addEventListener('mousemove', (e) => {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const factorX = x / (rect.width / 2);
      const factorY = y / (rect.height / 2);

      cards.forEach((card) => {
        const depth = parseFloat(card.dataset.depth || '1');
        const rotate = parseFloat(card.dataset.rotate || '0');
        const moveX = factorX * 16 * depth;
        const moveY = factorY * 14 * depth;
        const rotY = factorX * 8 * depth;
        const rotX = -factorY * 8 * depth;

        card.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) rotate(${rotate}deg) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      });
    });

    stage.addEventListener('mouseleave', () => {
      cards.forEach((card) => {
        const rotate = parseFloat(card.dataset.rotate || '0');
        card.style.transform = `rotate(${rotate}deg) translate(0, 0)`;
      });
    });
  }

  // 3. Countdown Timer to Launch Date
  // Launch target: 14 days from now or fixed date
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 18);
  targetDate.setHours(10, 0, 0, 0);

  const daysEl = document.getElementById('cs-days');
  const hoursEl = document.getElementById('cs-hours');
  const minsEl = document.getElementById('cs-mins');
  const secsEl = document.getElementById('cs-secs');

  function updateCountdown() {
    const now = new Date().getTime();
    const distance = targetDate.getTime() - now;

    if (distance < 0) {
      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minsEl) minsEl.textContent = '00';
      if (secsEl) secsEl.textContent = '00';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(minutes).padStart(2, '0');
    if (secsEl) secsEl.textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // 4. Notify Form Submission & Toast
  const form = document.getElementById('cs-notify-form');
  const toast = document.getElementById('cs-toast');

  function showToast(message) {
    if (!toast) return;
    toast.innerHTML = `<span>✦</span><span>${message}</span>`;
    toast.classList.add('is-visible');
    setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 4000);
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('.cs-notify-input');
      const email = input ? input.value.trim() : '';

      if (email && email.includes('@')) {
        showToast("You're on the list! We'll notify you the moment we launch.");
        if (input) input.value = '';
      } else {
        showToast('Please enter a valid email address.');
      }
    });
  }
});

