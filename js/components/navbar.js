/* --- 0. Dynamic Navbar Scroll Shrink --- */
export function initDynamicNavbar() {
    const nav = document.querySelector('nav');
    const hero = document.querySelector('#hero');
    if (!nav || !hero) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {

            if (entry.isIntersecting) {
                // نحن داخل الهيرو → الزر بحجمه الطبيعي
                nav.classList.remove('scrolled');
            } else {
                // خرجنا من الهيرو → الزر يصغر
                nav.classList.add('scrolled');
            }

        });
    }, {
        root: null,
        threshold: 0
    });

    observer.observe(hero);
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
