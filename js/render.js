window.getAbsoluteImageUrl = function (storedPath) {
    if (!storedPath) return '';
    if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) return storedPath;

    if (storedPath.startsWith('/uploads/')) {
        storedPath = storedPath.substring(1);
    }

    const pathname = window.location.pathname;
    let basePath = pathname.replace(/\/[^\/]*$/, '');

    return window.location.origin + basePath + '/' + storedPath;
};

window.renderHero = function (data) {
    const heroImg = document.querySelector('.hero-image img');
    if (!heroImg) return;

    if (data && data.hero && data.hero.imageUrl && typeof data.hero.imageUrl === 'string' && data.hero.imageUrl.trim() !== '') {
        heroImg.src = window.getAbsoluteImageUrl(data.hero.imageUrl);
        heroImg.alt = 'Hero Image';
        heroImg.classList.remove('empty');
    } else {
        // Neutral blank image state — do NOT use placeholder.jpg or fake content
        heroImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        heroImg.alt = '';
        heroImg.classList.add('empty');
    }
};

window.renderPortfolio = function (data) {
    const galleries = document.querySelectorAll('.gallery');
    if (galleries.length === 0) return;

    // Clear all galleries first
    galleries.forEach(gallery => {
        while (gallery.firstChild) {
            gallery.removeChild(gallery.firstChild);
        }
    });

    // Check for empty or missing portfolio
    if (!data || !Array.isArray(data.portfolio) || data.portfolio.length === 0) {
        const primaryGallery = galleries[0];
        if (primaryGallery) {
            const emptyElem = document.createElement('div');
            emptyElem.className = 'empty-state portfolio-empty';
            emptyElem.setAttribute('role', 'status');
            emptyElem.innerHTML = '<p class="empty-state-text">No portfolio projects published yet. New work will appear here soon.</p>';
            primaryGallery.appendChild(emptyElem);
        }
        if (typeof window.updateAllGalleryNav === 'function') {
            window.updateAllGalleryNav();
        }
        return;
    }

    // Check if multi-section gallery setup is present
    const hasSectionGalleries = Array.from(galleries).some(g => g.dataset.section);

    if (hasSectionGalleries) {
        const defaultSections = ['Section 1', 'Section 2', 'Section 3'];
        const orderedSections = [];

        // Discover section order sequence from saved portfolio projects order
        data.portfolio.forEach(item => {
            const sec = item.section || 'Section 1';
            if (!orderedSections.includes(sec)) {
                orderedSections.push(sec);
            }
        });

        // Append any default sections not present in data
        defaultSections.forEach(sec => {
            if (!orderedSections.includes(sec)) {
                orderedSections.push(sec);
            }
        });

        const sectionsMap = {};
        orderedSections.forEach(sec => { sectionsMap[sec] = []; });

        data.portfolio.forEach(item => {
            const sec = item.section || 'Section 1';
            if (!sectionsMap[sec]) sectionsMap[sec] = [];
            sectionsMap[sec].push(item);
        });

        const portfolioSections = Array.from(document.querySelectorAll('.portfolio-section'));

        orderedSections.forEach((secName, idx) => {
            let parentSec = portfolioSections[idx];
            if (parentSec) {
                const h2 = parentSec.querySelector('h2');
                if (h2) h2.textContent = secName;

                const gallery = parentSec.querySelector('.gallery');
                if (gallery) {
                    gallery.dataset.section = secName;
                    const items = sectionsMap[secName] || [];

                    while (gallery.firstChild) {
                        gallery.removeChild(gallery.firstChild);
                    }

                    items.forEach(item => {
                        const itemElem = document.createElement('div');
                        itemElem.className = 'gallery-item reveal';

                        const imgElem = document.createElement('img');
                        if (item.imageUrl) {
                            imgElem.src = window.getAbsoluteImageUrl(item.imageUrl);
                        } else {
                            imgElem.src = 'https://via.placeholder.com/400x300?text=Image';
                        }
                        imgElem.alt = item.title || 'Portfolio Image';
                        imgElem.loading = 'lazy';

                        const hasTitle = item.title && typeof item.title === 'string' && item.title.trim() !== '';
                        let textElem = null;
                        if (hasTitle) {
                            textElem = document.createElement('p');
                            textElem.className = 'gallery-title';
                            textElem.textContent = item.title.trim();
                        }

                        if (item.description) {
                            itemElem.title = item.description;
                        }

                        if (item.link && item.link.trim() !== '') {
                            const linkElem = document.createElement('a');
                            linkElem.href = item.link;
                            linkElem.target = '_blank';
                            linkElem.rel = 'noopener noreferrer';
                            linkElem.style.display = 'block';
                            linkElem.style.textDecoration = 'none';
                            linkElem.style.color = 'inherit';
                            linkElem.appendChild(imgElem);
                            if (textElem) linkElem.appendChild(textElem);
                            itemElem.appendChild(linkElem);
                        } else {
                            itemElem.appendChild(imgElem);
                            if (textElem) itemElem.appendChild(textElem);
                        }
                        gallery.appendChild(itemElem);
                    });
                }
            }
        });
    } else {
        // Fallback for single gallery container
        const container = galleries[0];
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        data.portfolio.forEach(item => {
            const itemElem = document.createElement('div');
            itemElem.className = 'gallery-item reveal';

            const imgElem = document.createElement('img');
            if (item.imageUrl) {
                imgElem.src = window.getAbsoluteImageUrl(item.imageUrl);
            } else {
                imgElem.src = 'https://via.placeholder.com/400x300?text=Image';
            }
            imgElem.alt = item.title || 'Portfolio Image';
            imgElem.loading = 'lazy';

            const hasTitle = item.title && typeof item.title === 'string' && item.title.trim() !== '';
            let textElem = null;
            if (hasTitle) {
                textElem = document.createElement('p');
                textElem.className = 'gallery-title';
                textElem.textContent = item.title.trim();
            }

            if (item.description) {
                itemElem.title = item.description;
            }

            if (item.link && item.link.trim() !== '') {
                const linkElem = document.createElement('a');
                linkElem.href = item.link;
                linkElem.target = '_blank';
                linkElem.rel = 'noopener noreferrer';
                linkElem.style.display = 'block';
                linkElem.style.textDecoration = 'none';
                linkElem.style.color = 'inherit';
                linkElem.appendChild(imgElem);
                if (textElem) linkElem.appendChild(textElem);
                itemElem.appendChild(linkElem);
            } else {
                itemElem.appendChild(imgElem);
                if (textElem) itemElem.appendChild(textElem);
            }
            container.appendChild(itemElem);
        });
    }

    if (typeof window.updateAllGalleryNav === 'function') {
        window.updateAllGalleryNav();
    }
};

window.renderFeedbacks = function (data) {
    const container = document.querySelector('.feedback-grid');
    if (!container) return;

    // Clear existing
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Check for empty or missing feedbacks
    if (!data || !Array.isArray(data.feedbacks) || data.feedbacks.length === 0) {
        const emptyElem = document.createElement('div');
        emptyElem.className = 'empty-state feedback-empty';
        emptyElem.setAttribute('role', 'status');
        emptyElem.innerHTML = '<p class="empty-state-text">No client feedbacks published yet. Reviews will appear here soon.</p>';
        container.appendChild(emptyElem);
        return;
    }

    data.feedbacks.forEach(item => {
        const article = document.createElement('article');
        article.className = 'card feedback-card reveal';

        // Stars Rating (Warm Gold)
        const stars = document.createElement('div');
        stars.className = 'feedback-stars';
        const rating = item.rating || 5;
        stars.setAttribute('aria-label', `${rating} out of 5 stars`);
        stars.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        article.appendChild(stars);

        // Testimonial Text (Italic Quote)
        const textElem = document.createElement('p');
        textElem.className = 'feedback-text';
        textElem.textContent = `"${item.text || ''}"`;
        article.appendChild(textElem);

        // Cyan Accent Client Name
        const name = item.clientName || 'Anonymous';
        const clientSpan = document.createElement('span');
        clientSpan.className = 'feedback-client';
        clientSpan.textContent = name;
        article.appendChild(clientSpan);

        if (item.imageUrl) {
            article.classList.add('has-image');
            article.dataset.imageUrl = window.getAbsoluteImageUrl(item.imageUrl);

            const imgIndicator = document.createElement('div');
            imgIndicator.className = 'feedback-image-indicator';
            imgIndicator.textContent = 'VIEW FEEDBACK';
            article.appendChild(imgIndicator);
        }

        container.appendChild(article);
    });
};
