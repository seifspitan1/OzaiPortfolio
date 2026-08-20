/**
 * Gallery Horizontal Navigation Module
 *
 * Implements:
 * 1. Independent mouse-wheel horizontal scrolling with boundary release to natural page scrolling
 * 2. Accessible Previous / Next arrow button navigation with real DOM card positioning
 * 3. Idempotent initialization & dynamic DOM management
 */

// Track active gallery instances to prevent duplicate bindings and support clean lifecycle management
const galleryInstances = new Map();

/**
 * Calculates the target scrollLeft position for moving one card step.
 * Computes live card positions relative to container viewport scroll.
 * Handles subpixel layout, gaps, and snap alignments accurately.
 * @param {HTMLElement} container
 * @param {'prev' | 'next'} direction
 * @returns {number}
 */
function getCardTargetScrollLeft(container, direction) {
    const items = Array.from(container.querySelectorAll('.gallery-item'));
    if (items.length === 0) return container.scrollLeft;

    const containerRect = container.getBoundingClientRect();
    const currentScroll = container.scrollLeft;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const subpixelTolerance = 3; // px tolerance for snap offsets and subpixel layout

    // Calculate actual position of each card in the scroll space
    const cardPositions = items.map(item => {
        const itemRect = item.getBoundingClientRect();
        return itemRect.left - containerRect.left + currentScroll;
    });

    if (direction === 'next') {
        for (const pos of cardPositions) {
            if (pos > currentScroll + subpixelTolerance) {
                return Math.min(pos, maxScrollLeft);
            }
        }
        return maxScrollLeft;
    } else {
        for (let i = cardPositions.length - 1; i >= 0; i--) {
            const pos = cardPositions[i];
            if (pos < currentScroll - subpixelTolerance) {
                return Math.max(0, pos);
            }
        }
        return 0;
    }
}

/**
 * Updates the disabled and visibility states of the navigation buttons.
 * @param {HTMLElement} container
 * @param {HTMLButtonElement} prevBtn
 * @param {HTMLButtonElement} nextBtn
 * @param {HTMLElement} wrapper
 */
function updateNavButtonStates(container, prevBtn, nextBtn, wrapper) {
    if (!container || !prevBtn || !nextBtn) return;

    const clientWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    const scrollLeft = container.scrollLeft;
    const maxScrollLeft = scrollWidth - clientWidth;
    const items = container.querySelectorAll('.gallery-item');

    // Check if gallery has horizontal overflow and enough items
    const hasOverflow = items.length > 1 && maxScrollLeft > 3;

    if (!hasOverflow) {
        if (wrapper) {
            wrapper.classList.add('gallery-no-overflow');
        }
        prevBtn.disabled = true;
        prevBtn.setAttribute('aria-disabled', 'true');
        nextBtn.disabled = true;
        nextBtn.setAttribute('aria-disabled', 'true');
        return;
    }

    if (wrapper) {
        wrapper.classList.remove('gallery-no-overflow');
    }

    const subpixelTolerance = 3;
    const isAtStart = scrollLeft <= subpixelTolerance;
    const isAtEnd = scrollLeft >= maxScrollLeft - subpixelTolerance;

    // Previous button state
    prevBtn.disabled = isAtStart;
    prevBtn.setAttribute('aria-disabled', isAtStart ? 'true' : 'false');

    // Next button state
    nextBtn.disabled = isAtEnd;
    nextBtn.setAttribute('aria-disabled', isAtEnd ? 'true' : 'false');
}

/**
 * Creates the non-passive wheel event listener for converting vertical wheel into horizontal card scrolling.
 * Uses real-DOM card target calculation and a short gesture cooldown to prevent CSS scroll-snap reverts
 * and multiple accidental card jumps on high-frequency wheel events.
 * @param {HTMLElement} container
 * @returns {(e: WheelEvent) => void}
 */
function createWheelHandler(container) {
    let wheelLockUntil = 0;
    let lastDirection = null;

    return function handleWheel(e) {
        // If horizontal trackpad input is dominant, preserve browser's native horizontal scrolling
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            return;
        }

        // If vertical delta is 0, do nothing
        if (e.deltaY === 0) {
            return;
        }

        const clientWidth = container.clientWidth;
        const scrollWidth = container.scrollWidth;
        const maxScrollLeft = scrollWidth - clientWidth;

        // If gallery has no overflow, allow vertical page scroll
        if (maxScrollLeft <= 3) {
            return;
        }

        const scrollLeft = container.scrollLeft;
        const subpixelTolerance = 3;
        const canScrollLeft = scrollLeft > subpixelTolerance;
        const canScrollRight = scrollLeft < maxScrollLeft - subpixelTolerance;

        const isMovingRight = e.deltaY > 0;
        const isMovingLeft = e.deltaY < 0;

        const now = performance.now();

        // Conditionally intercept only when movement is possible in the requested direction
        if (isMovingRight && canScrollRight) {
            e.preventDefault();
            if (now > wheelLockUntil || lastDirection !== 'next') {
                const target = getCardTargetScrollLeft(container, 'next');
                container.scrollTo({ left: target, behavior: 'smooth' });
                wheelLockUntil = now + 350;
                lastDirection = 'next';
            }
        } else if (isMovingLeft && canScrollLeft) {
            e.preventDefault();
            if (now > wheelLockUntil || lastDirection !== 'prev') {
                const target = getCardTargetScrollLeft(container, 'prev');
                container.scrollTo({ left: target, behavior: 'smooth' });
                wheelLockUntil = now + 350;
                lastDirection = 'prev';
            }
        } else {
            // At horizontal boundaries (first or last card), release lock and do NOT prevent default,
            // allowing the browser to vertically scroll the page naturally without trapping the user.
            wheelLockUntil = 0;
            lastDirection = null;
        }
    };
}

/**
 * Initializes or updates navigation for a single gallery element.
 * Idempotent: safe to call multiple times without duplicate bindings.
 * @param {HTMLElement} container
 */
export function setupGalleryInstance(container) {
    if (!container) return;

    // Ensure wrapper element exists
    let wrapper = container.parentElement;
    if (!wrapper || !wrapper.classList.contains('gallery-wrapper')) {
        wrapper = document.createElement('div');
        wrapper.className = 'gallery-wrapper';
        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(container);
    }

    // Ensure Previous button exists
    let prevBtn = wrapper.querySelector('.gallery-nav-prev');
    if (!prevBtn) {
        prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'gallery-nav-btn gallery-nav-prev';
        prevBtn.setAttribute('aria-label', 'Previous portfolio image');
        prevBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>';
        wrapper.insertBefore(prevBtn, container);
    }

    // Ensure Next button exists
    let nextBtn = wrapper.querySelector('.gallery-nav-next');
    if (!nextBtn) {
        nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'gallery-nav-btn gallery-nav-next';
        nextBtn.setAttribute('aria-label', 'Next portfolio image');
        nextBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        wrapper.appendChild(nextBtn);
    }

    // Check if instance is already registered for this container
    const existing = galleryInstances.get(container);
    if (existing) {
        // Just update states for newly loaded dynamic data / layout changes
        existing.updateStates();
        return;
    }

    // Bind wheel listener to wrapper (non-passive to allow conditional preventDefault on any card/gap/button hover)
    const wheelHandler = createWheelHandler(container);
    wrapper.addEventListener('wheel', wheelHandler, { passive: false });

    // Bind Previous button click handler (smooth card step)
    const onPrevClick = (e) => {
        e.preventDefault();
        const targetLeft = getCardTargetScrollLeft(container, 'prev');
        container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    };
    prevBtn.addEventListener('click', onPrevClick);

    // Bind Next button click handler (smooth card step)
    const onNextClick = (e) => {
        e.preventDefault();
        const targetLeft = getCardTargetScrollLeft(container, 'next');
        container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    };
    nextBtn.addEventListener('click', onNextClick);

    // Throttled scroll listener to update button states efficiently
    let scrollRafId = null;
    const onScroll = () => {
        if (scrollRafId) return;
        scrollRafId = requestAnimationFrame(() => {
            updateNavButtonStates(container, prevBtn, nextBtn, wrapper);
            scrollRafId = null;
        });
    };
    container.addEventListener('scroll', onScroll, { passive: true });

    // ResizeObserver to detect layout / card dimension changes
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            updateNavButtonStates(container, prevBtn, nextBtn, wrapper);
        });
        resizeObserver.observe(container);
    }

    // MutationObserver to detect dynamically added / removed gallery-item cards
    let mutationObserver = null;
    if (typeof MutationObserver !== 'undefined') {
        mutationObserver = new MutationObserver(() => {
            updateNavButtonStates(container, prevBtn, nextBtn, wrapper);
        });
        mutationObserver.observe(container, { childList: true });
    }

    const updateStates = () => {
        updateNavButtonStates(container, prevBtn, nextBtn, wrapper);
    };

    const destroy = () => {
        wrapper.removeEventListener('wheel', wheelHandler);
        prevBtn.removeEventListener('click', onPrevClick);
        nextBtn.removeEventListener('click', onNextClick);
        container.removeEventListener('scroll', onScroll);
        if (scrollRafId) cancelAnimationFrame(scrollRafId);
        if (resizeObserver) resizeObserver.disconnect();
        if (mutationObserver) mutationObserver.disconnect();
    };

    galleryInstances.set(container, {
        wrapper,
        prevBtn,
        nextBtn,
        updateStates,
        destroy
    });

    // Initial state update
    updateStates();
}

/**
 * Discovers and initializes all .gallery elements across the document,
 * cleans up removed galleries, and updates button states.
 */
export function updateAllGalleryNav() {
    // Clean up instances whose elements are no longer in DOM
    for (const [container, instance] of galleryInstances.entries()) {
        if (!document.body.contains(container)) {
            instance.destroy();
            galleryInstances.delete(container);
        }
    }

    // Discover and setup every gallery container
    const galleries = document.querySelectorAll('.gallery');
    galleries.forEach(gallery => {
        setupGalleryInstance(gallery);
    });
}

/**
 * Initializes the gallery navigation feature on page load
 * and attaches window-level resize listener.
 */
export function initGalleryNav() {
    updateAllGalleryNav();

    // Window resize handler with debounce/RAF to refresh all gallery states
    let windowResizeRaf = null;
    window.addEventListener('resize', () => {
        if (windowResizeRaf) return;
        windowResizeRaf = requestAnimationFrame(() => {
            for (const instance of galleryInstances.values()) {
                instance.updateStates();
            }
            windowResizeRaf = null;
        });
    }, { passive: true });
}
