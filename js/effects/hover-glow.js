/* --- Effect 3: Hover Glow Cards --- */
export function initHoverGlow() {
    const gallery = document.querySelector('.gallery');
    if (!gallery) return;

    let activeItem = null;
    let rect = null;
    let ticking = false;

    // Use event delegation on the gallery parent container
    gallery.addEventListener('mousemove', e => {
        const item = e.target.closest('.gallery-item');
        if (!item) {
            if (activeItem) {
                activeItem = null;
                rect = null;
            }
            return;
        }

        // Cache bounding rectangle when mouse moves over a new dynamic item
        if (item !== activeItem) {
            activeItem = item;
            rect = item.getBoundingClientRect();
        }

        const clientX = e.clientX;
        const clientY = e.clientY;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (activeItem && rect) {
                    const x = clientX - rect.left;
                    const y = clientY - rect.top;

                    // Batch DOM property writes
                    activeItem.style.setProperty('--mouse-x', `${x}px`);
                    activeItem.style.setProperty('--mouse-y', `${y}px`);
                }
                ticking = false;
            });
            ticking = true;
        }
    });

    // Clear cache when mouse leaves the gallery bounds entirely
    gallery.addEventListener('mouseleave', () => {
        activeItem = null;
        rect = null;
    });

    // Recalculate dimensions on window resize while hovering
    window.addEventListener('resize', () => {
        if (activeItem) {
            rect = activeItem.getBoundingClientRect();
        }
    });
}
