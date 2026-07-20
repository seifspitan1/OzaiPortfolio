/* --- 0. Dynamic Navbar Scroll Shrink --- */
export function initDynamicNavbar() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    // Publish initial navbar height as a CSS custom property
    document.documentElement.style.setProperty('--nav-height', nav.offsetHeight + 'px');

    function updateNavState() {
        const isScrolled = window.scrollY > 50;
        if (isScrolled !== nav.classList.contains('scrolled')) {
            if (isScrolled) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
            document.documentElement.style.setProperty('--nav-height', nav.offsetHeight + 'px');
            setTimeout(() => {
                document.documentElement.style.setProperty('--nav-height', nav.offsetHeight + 'px');
            }, 420); // slightly after the 400ms min-height transition
        }
    }

    window.addEventListener('scroll', updateNavState, { passive: true });
    updateNavState();
}

/* --- 1. Mobile Navigation Toggle --- */
export function initMobileNav() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navContainer = document.querySelector('nav');

    if (!menuToggle || !navContainer) return;

    menuToggle.addEventListener('click', () => {
        const isOpen = navContainer.classList.toggle('nav-open');
        menuToggle.setAttribute('aria-expanded', isOpen);
    });
}
