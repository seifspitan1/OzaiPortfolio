/* --- Effect 2: Magnetic Buttons --- */
export function initMagneticButtons() {
    const magneticButtons = document.querySelectorAll('.magnetic');

    magneticButtons.forEach(btn => {
        let ticking = false;
        let rect = null;

        // Cache the bounding rectangle on mouse enter to avoid reflow every frame
        btn.addEventListener('mouseenter', () => {
            rect = btn.getBoundingClientRect();
        });

        // Recalculate dimensions if the window is resized while hovering
        window.addEventListener('resize', () => {
            if (btn.matches(':hover')) {
                rect = btn.getBoundingClientRect();
            }
        });

        btn.addEventListener('mousemove', e => {
            // Fallback if mouseenter didn't fire (e.g., edge cases)
            if (!rect) rect = btn.getBoundingClientRect();

            // Cache event coordinates before RAF
            const clientX = e.clientX;
            const clientY = e.clientY;

            if (!ticking) {
                window.requestAnimationFrame(() => {
                    // Separation of read/write: we only write to DOM inside RAF
                    const x = clientX - rect.left - rect.width / 2;
                    const y = clientY - rect.top - rect.height / 2;

                    btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
                    ticking = false;
                });
                ticking = true;
            }
        });

        btn.addEventListener('mouseleave', () => {
            rect = null; // Clear cache
            window.requestAnimationFrame(() => {
                btn.style.transform = ''; // Reverts to CSS default constraints
            });
        });
    });
}
