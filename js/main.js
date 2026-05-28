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
