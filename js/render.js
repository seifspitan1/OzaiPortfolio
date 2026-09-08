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

function reorderPortfolioSections(sections) {
    if (!sections || !Array.isArray(sections) || sections.length === 0) return;

    const existingSections = Array.from(document.querySelectorAll('.portfolio-section'));
    if (existingSections.length === 0) return;

    const parent = existingSections[0].parentNode;
    if (!parent) return;

    // Filter to sections belonging to the same parent container
    const siblingSections = existingSections.filter(node => node.parentNode === parent);
    if (siblingSections.length === 0) return;

    // Map existing sections by data-section-id as the ONLY identity source
    const sectionMap = new Map();
    siblingSections.forEach(node => {
        const secId = node.dataset && node.dataset.sectionId;
        if (secId && !sectionMap.has(secId)) {
            sectionMap.set(secId, node);
        }
    });

    const orderedNodes = [];
    const placedNodes = new Set();

    // 1. Add canonical sections in sorted order
    sections.forEach(sec => {
        if (sec && sec.id && sectionMap.has(sec.id)) {
            const node = sectionMap.get(sec.id);
            if (!placedNodes.has(node)) {
                orderedNodes.push(node);
                placedNodes.add(node);
            }
        }
    });

    // 2. Preserve unknown/unregistered DOM sections instead of deleting them
    siblingSections.forEach(node => {
        if (!placedNodes.has(node)) {
            orderedNodes.push(node);
            placedNodes.add(node);
        }
    });

    // Check if the DOM nodes are already in the exact target order
    const isAlreadyOrdered = siblingSections.length === orderedNodes.length &&
        siblingSections.every((node, i) => node === orderedNodes[i]);

    if (isAlreadyOrdered) return;

    // 3. Move existing nodes in place safely using a temporary comment marker and DocumentFragment
    const marker = document.createComment('portfolio-marker');
    parent.insertBefore(marker, siblingSections[0]);

    const fragment = document.createDocumentFragment();
    orderedNodes.forEach(node => {
        fragment.appendChild(node);
    });

    parent.insertBefore(fragment, marker);
    if (marker.parentNode) {
        marker.parentNode.removeChild(marker);
    }
}

window.renderPortfolio = function (data) {
    let sections = [];
    if (data && Array.isArray(data.sections) && data.sections.length > 0) {
        // Sort a copy of data.sections numerically by order ascending
        sections = data.sections
            .slice()
            .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    } else if (data && Array.isArray(data.portfolio) && data.portfolio.length > 0) {
        // Backward-compatibility derivation if data.sections is absent
        const defaultSections = [
            { id: 'sec-1', title: 'Cartoon Roblox Studio', order: 1 },
            { id: 'sec-2', title: 'Semi Realistic', order: 2 },
            { id: 'sec-3', title: 'Realistic', order: 3 }
        ];
        const foundTitles = [];
        data.portfolio.forEach(item => {
            const sec = item.section || 'Cartoon Roblox Studio';
            if (!foundTitles.includes(sec)) foundTitles.push(sec);
        });
        sections = defaultSections.map((def, idx) => ({
            id: def.id,
            title: foundTitles[idx] || def.title,
            order: def.order
        }));
    }

    // Physically reorder existing .portfolio-section DOM nodes to match canonical order
    if (sections.length > 0) {
        reorderPortfolioSections(sections);
    }

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
        // If sections are configured, render their canonical titles even when portfolio is empty
        if (sections.length > 0) {
            sections.forEach(sec => {
                const parentSec = document.querySelector(`.portfolio-section[data-section-id="${sec.id}"]`);
                if (parentSec) {
                    const h2 = parentSec.querySelector('h2');
                    if (h2 && sec.title) h2.textContent = sec.title;
                }
            });
        }
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
    const hasSectionGalleries = Array.from(galleries).some(g => g.dataset.section || g.dataset.sectionId);

    if (hasSectionGalleries) {
        sections.forEach(sec => {
            // Match by stable data-section-id as the ONLY identity source
            const parentSec = document.querySelector(`.portfolio-section[data-section-id="${sec.id}"]`);
            if (!parentSec) return;

            const h2 = parentSec.querySelector('h2');
            if (h2 && sec.title) h2.textContent = sec.title;

            const gallery = parentSec.querySelector('.gallery');
            if (!gallery) return;

            gallery.dataset.sectionId = sec.id;
            if (sec.title) {
                gallery.dataset.section = sec.title;
            }

            const items = data.portfolio.filter(p => {
                if (p.sectionId) {
                    return p.sectionId === sec.id;
                }
                return (p.section || 'Cartoon Roblox Studio') === sec.title;
            });

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
