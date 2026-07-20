/* --- 2. Smooth Anchor Scroll --- */

/**
 * Reads the current navbar height from the CSS custom property
 * that navbar.js keeps updated on every scroll-state change.
 * Falls back to 64px (the scrolled state) if the variable is missing.
 */
function getNavHeight() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-height');
    return parseFloat(raw) || 64;
}

export function initSmoothScroll() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]:not([href="#"])');
    const navContainer = document.querySelector('nav');
    // Desired gap between navbar bottom edge and the section label
    const GAP = 24;

    anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const targetId = link.getAttribute('href');
            const targetEl = document.querySelector(targetId);

            if (!targetEl) return;

            // Close mobile menu if open
            if (navContainer && navContainer.classList.contains('nav-open')) {
                navContainer.classList.remove('nav-open');
            }

            // Hero → scroll to absolute page top
            if (targetId === '#hero') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // All other sections: use the scrolled navbar height (64px)
            // regardless of current state, because that is what the
            // navbar WILL be when any non-hero section is in view.
            const scrolledNavHeight = 64;
            const anchor = targetEl.querySelector('.section-tag') || targetEl;
            const anchorTop = anchor.getBoundingClientRect().top + window.pageYOffset;

            window.scrollTo({
                top: Math.max(0, anchorTop - scrolledNavHeight - GAP),
                behavior: 'smooth'
            });
        });
    });
}
