/* --- Effect 5: Scroll Parallax --- */
export function initParallax() {
    const galleryContainer = document.querySelector('.gallery');

    if (!galleryContainer) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
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
