let observer = null;

export function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15
    });

    reveals.forEach(el => observer.observe(el));

    // Bind to window to allow non-module scripts to register dynamic elements
    window.observeNewReveals = (elements) => {
        if (!observer || !elements) return;
        elements.forEach(el => {
            if (!el.classList.contains('active')) {
                observer.observe(el);
            }
        });
    };
}

export function observeNewReveals(elements) {
    if (!observer || !elements) return;
    elements.forEach(el => {
        if (!el.classList.contains('active')) {
            observer.observe(el);
        }
    });
}
