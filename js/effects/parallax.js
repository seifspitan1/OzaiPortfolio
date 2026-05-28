/* --- Effect 5: Scroll Parallax --- */
export function initParallax() {
    const heroSection = document.querySelector('#hero');
    const galleryContainer = document.querySelector('.gallery');

    if (!heroSection && !galleryContainer) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scroll = window.scrollY;

                // Hero Background subtle parallax
                if (heroSection) {
                    heroSection.style.transform = `translate3d(0, ${scroll * 0.15}px, 0)`;
                }

                // Gallery subtle scroll mapping
                if (galleryContainer) {
                    const rect = galleryContainer.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        const offset = (window.innerHeight - rect.top) * 0.05;
                        galleryContainer.style.transform = `translate3d(0, -${offset}px, 0)`;
                    }
                }

                ticking = false;
            });
            ticking = true;
        }
    });
}
