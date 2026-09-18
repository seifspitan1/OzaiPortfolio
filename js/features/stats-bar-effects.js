/**
 * Stats Bar Interactive Motion & Counter Lifecycle
 * 
 * Strict Viewport Intersection Lifecycle:
 * 1. Pre-animation: Numbers initialized to 0 while hidden (opacity: 0, zero flash)
 * 2. Intersection trigger: Requires ~35% meaningful visibility in viewport before starting.
 *    Does NOT trigger on page load when sitting at scrollTop: 0 with only peeking overlap.
 * 3. Entrance & Stagger: .is-visible applied -> container rises & stat items stagger in.
 * 4. Dividers draw outward from center (scaleY(0) -> scaleY(1), ~580ms).
 * 5. Staggered count-up (0 -> 4+, 0 -> 1,136+, 0 -> 325+).
 * 6. Staggered label reveal: Each label smoothly slides out from below its counting number.
 * 7. Finish glow: 400ms subtle glow pulse upon reaching target values.
 * 8. Settled state: .is-settled applied -> enables idle glass sheen & ambient glow.
 * 9. Desktop Mouse Spotlight: Soft radial light reflection following cursor inside container.
 * 10. Disconnects observer so scrolling away & back NEVER restarts animations.
 */

export function initStatsBarEffects() {
    const wrapper = document.querySelector('.stats-bar-wrapper');
    if (!wrapper) return;

    const container = wrapper.querySelector('.stats-bar-container');

    // Accessibility: Immediately display final state for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        wrapper.classList.add('is-visible', 'is-settled');
        return;
    }

    const statItems = wrapper.querySelectorAll('.stat-item');
    if (!statItems.length) return;

    // Desktop Mouse Spotlight: subtle radial reflection tracking cursor inside container
    if (container) {
        initMouseSpotlight(container, wrapper);
    }

    const statsConfig = [
        { target: 4, suffix: '+', duration: 800, staggerDelay: 120 },
        { target: 1136, suffix: '+', duration: 1200, staggerDelay: 220 },
        { target: 325, suffix: '+', duration: 1000, staggerDelay: 320 }
    ];

    // Initialize stable counter numbers while hidden (wrapper has opacity: 0)
    // Completely eliminates any flash of final values resetting to 0
    statItems.forEach((item, index) => {
        const numberElem = item.querySelector('.stat-number');
        if (numberElem) {
            const config = statsConfig[index];
            const suffix = config ? config.suffix : (item.dataset.suffix || '');
            numberElem.textContent = `0${suffix}`;
        }
    });

    let hasAnimated = false;

    // Threshold of 0.35 ensures the initial ~32.4% peeking overlap at scrollTop: 0 does NOT trigger.
    // Trigger occurs only when user meaningfully scrolls (35%+ of the component is visible).
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.35 && !hasAnimated) {
                hasAnimated = true;
                observer.disconnect();
                startEffects(wrapper, statItems, statsConfig);
            }
        });
    }, {
        threshold: [0, 0.2, 0.3, 0.35, 0.5, 0.7, 1.0]
    });

    observer.observe(wrapper);
}

function startEffects(wrapper, statItems, statsConfig) {
    // 1. Trigger container entrance, divider draw-in, & CSS stagger
    wrapper.classList.add('is-visible');

    // 2. Animate count-up for each stat number
    statItems.forEach((item, index) => {
        const numberElem = item.querySelector('.stat-number');
        if (!numberElem) return;

        const config = statsConfig[index] || {
            target: parseInt(item.dataset.target || '0', 10),
            suffix: item.dataset.suffix || '',
            duration: 1000,
            staggerDelay: index * 100
        };

        setTimeout(() => {
            animateCount(numberElem, config.target, config.suffix, config.duration);
        }, config.staggerDelay);
    });

    // 3. Mark settled after entrance, stagger, counters, and finish pulses complete (~1750ms)
    // Enables idle glass sheen, ambient glow, and eliminates stagger delays for hover
    setTimeout(() => {
        wrapper.classList.add('is-settled');
    }, 1750);
}

/**
 * Smooth ease-out cubic number counter
 */
function animateCount(elem, target, suffix, duration) {
    const startTime = performance.now();

    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Ease-out cubic: fast start, gradual deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * easeOut);

        elem.textContent = `${current.toLocaleString()}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            // Guarantee exact final value in DOM
            elem.textContent = `${target.toLocaleString()}${suffix}`;

            // Effect: Finish glow pulse
            elem.classList.add('finish-glow');
            setTimeout(() => {
                elem.classList.remove('finish-glow');
            }, 450);
        }
    }

    requestAnimationFrame(frame);
}

/**
 * Desktop Mouse Spotlight
 * Soft radial cyan/blue reflection following cursor across dark glass.
 * Throttled via requestAnimationFrame, strictly bounded to container,
 * inactive on touch devices & under reduced-motion preference.
 */
function initMouseSpotlight(container, wrapper) {
    if (!container || !wrapper) return;

    const finePointerMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (!finePointerMedia.matches || reducedMotionMedia.matches) return;

    let rafId = null;
    let targetX = 50;
    let targetY = 50;
    let isTracking = false;

    function updateSpotlight() {
        if (!isTracking) return;
        container.style.setProperty('--spotlight-x', `${targetX.toFixed(2)}%`);
        container.style.setProperty('--spotlight-y', `${targetY.toFixed(2)}%`);
        container.style.setProperty('--spotlight-opacity', '1');
        rafId = null;
    }

    function onPointerEnter(e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (!wrapper.classList.contains('is-visible')) return;
        if (reducedMotionMedia.matches) return;

        isTracking = true;
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            targetX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            targetY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        }

        if (!rafId) {
            rafId = requestAnimationFrame(updateSpotlight);
        }
    }

    function onPointerMove(e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (!wrapper.classList.contains('is-visible')) return;
        if (reducedMotionMedia.matches) return;

        isTracking = true;
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            targetX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            targetY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        }

        if (!rafId) {
            rafId = requestAnimationFrame(updateSpotlight);
        }
    }

    function onPointerLeave() {
        isTracking = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        container.style.setProperty('--spotlight-opacity', '0');
    }

    container.addEventListener('pointerenter', onPointerEnter);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);
    container.addEventListener('pointercancel', onPointerLeave);
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatsBarEffects);
} else {
    initStatsBarEffects();
}
