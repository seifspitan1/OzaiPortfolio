/* --- 2. Smooth Anchor Scroll --- */
export function initSmoothScroll() {
    // Select all links that start with # and aren't just '#'
    const anchorLinks = document.querySelectorAll('a[href^="#"]:not([href="#"])');
    const navContainer = document.querySelector('nav');

    anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const targetId = link.getAttribute('href');
            const targetContent = document.querySelector(targetId);

            if (targetContent) {
                // If mobile menu is open, close it when a link is clicked
                if (navContainer && navContainer.classList.contains('nav-open')) {
                    navContainer.classList.remove('nav-open');
                }

                targetContent.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}
