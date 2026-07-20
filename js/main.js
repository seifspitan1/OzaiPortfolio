/**
 * Ozai GFX Portfolio - Layer 5 (JavaScript Behavior)
 * 
 * Features Implemented:
 * 1. Mobile Navigation Toggle
 * 2. Smooth Anchor Scroll
 * 3. Active Navigation Highlight
 * 4. Portfolio Project Links
 */

import { initMobileNav, initDynamicNavbar } from './components/navbar.js';
import { initSmoothScroll } from './features/smooth-scroll.js';
import { initScrollSpy } from './features/scroll-spy.js';
import { initMagneticButtons } from './effects/magnetic.js';
import { initHoverGlow } from './effects/hover-glow.js';
import { initScrollReveal } from './effects/scroll-reveal.js';
import { initParallax } from './effects/parallax.js';

initMobileNav();
initDynamicNavbar();

initSmoothScroll();
initScrollSpy();

initMagneticButtons();
initHoverGlow();
initScrollReveal();
initParallax();

function initFeedbackLightbox() {
    const modal = document.getElementById('feedback-lightbox');
    if (!modal) return;

    const backdrop = modal.querySelector('.lightbox-backdrop');
    const closeBtn = modal.querySelector('.lightbox-close');
    const imgElem = modal.querySelector('.lightbox-image');

    function openModal(src) {
        if (!imgElem) return;
        imgElem.src = src;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (imgElem) imgElem.src = '';
    }

    document.addEventListener('click', e => {
        const card = e.target.closest('.feedback-card.has-image');
        if (card && card.dataset.imageUrl) {
            openModal(card.dataset.imageUrl);
        }
    });

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

initFeedbackLightbox();
