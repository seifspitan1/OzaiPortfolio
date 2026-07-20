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
    if (!data || !data.hero) return;
    const heroImg = document.querySelector('.hero-image img');
    if (heroImg) {
        if (data.hero.imageUrl) {
            heroImg.src = window.getAbsoluteImageUrl(data.hero.imageUrl);
        } else {
            heroImg.src = 'https://via.placeholder.com/400x300?text=Image';
        }
        heroImg.alt = 'Hero Image';
    }
};

window.renderPortfolio = function (data) {
    if (!data || !data.portfolio) return;

    const galleries = document.querySelectorAll('.gallery');
    if (galleries.length === 0) return;

    // Check if multi-section gallery setup is present
    const hasSectionGalleries = Array.from(galleries).some(g => g.dataset.section);

    if (hasSectionGalleries) {
        const sectionsMap = {
            'Section 1': [],
            'Section 2': [],
            'Section 3': []
        };

        data.portfolio.forEach(item => {
            const sec = item.section || 'Section 1';
            if (sectionsMap[sec]) {
                sectionsMap[sec].push(item);
            } else {
                sectionsMap['Section 1'].push(item);
            }
        });

        galleries.forEach(gallery => {
            const secName = gallery.dataset.section || 'Section 1';
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

                const textElem = document.createElement('p');
                textElem.className = 'gallery-title';
                textElem.textContent = item.title || 'Untitled';

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
                    linkElem.appendChild(textElem);
                    itemElem.appendChild(linkElem);
                } else {
                    itemElem.appendChild(imgElem);
                    itemElem.appendChild(textElem);
                }
                gallery.appendChild(itemElem);
            });
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

            const textElem = document.createElement('p');
            textElem.className = 'gallery-title';
            textElem.textContent = item.title || 'Untitled';

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
                linkElem.appendChild(textElem);
                itemElem.appendChild(linkElem);
            } else {
                itemElem.appendChild(imgElem);
                itemElem.appendChild(textElem);
            }
            container.appendChild(itemElem);
        });
    }
};

window.renderFeedbacks = function (data) {
    if (!data || !data.feedbacks) return;
    const container = document.querySelector('.feedback-grid');
    if (!container) return;

    // Clear existing
    while (container.firstChild) {
        container.removeChild(container.firstChild);
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
