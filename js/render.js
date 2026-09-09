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

window.isSupabaseStorageUrl = function (url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('/storage/v1/object/public/');
};

window.getOptimizedImageUrl = function (canonicalUrl, options = {}) {
    if (!canonicalUrl || typeof canonicalUrl !== 'string') return '';
    if (!window.isSupabaseStorageUrl(canonicalUrl)) return canonicalUrl;

    const { width, height, quality = 80, format = 'webp', resize = 'cover' } = options;
    const transformUrl = canonicalUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const params = [];
    if (width) params.push('width=' + encodeURIComponent(width));
    if (height) params.push('height=' + encodeURIComponent(height));
    if (resize && resize !== 'cover') params.push('resize=' + encodeURIComponent(resize));
    if (quality) params.push('quality=' + encodeURIComponent(quality));
    if (format) params.push('format=' + encodeURIComponent(format));

    return params.length > 0 ? `${transformUrl}?${params.join('&')}` : transformUrl;
};

window.setupImageFallback = function (imgElem, canonicalUrl) {
    if (!imgElem || !canonicalUrl) return;
    imgElem.dataset.canonicalSrc = canonicalUrl;
    imgElem.onerror = function () {
        if (!imgElem.dataset.fallbackApplied) {
            imgElem.dataset.fallbackApplied = 'true';
            imgElem.removeAttribute('srcset');
            imgElem.removeAttribute('sizes');
            imgElem.src = canonicalUrl;
        }
    };
};

window.renderHero = function (data) {
    const heroImg = document.querySelector('.hero-image img');
    if (!heroImg) return;

    if (data && data.hero && data.hero.imageUrl && typeof data.hero.imageUrl === 'string' && data.hero.imageUrl.trim() !== '') {
        const canonicalUrl = window.getAbsoluteImageUrl(data.hero.imageUrl);

        // 1. Configure loading policy and priority BEFORE assigning source
        heroImg.loading = 'eager';
        if ('fetchPriority' in heroImg) {
            heroImg.fetchPriority = 'high';
        } else {
            heroImg.setAttribute('fetchpriority', 'high');
        }
        heroImg.decoding = 'async';

        // 2. Setup one-time fallback to canonical original if transform fails
        window.setupImageFallback(heroImg, canonicalUrl);

        // 3. Responsive variants if Supabase-managed, or direct canonical if unsupported
        if (window.isSupabaseStorageUrl(canonicalUrl)) {
            const w400 = window.getOptimizedImageUrl(canonicalUrl, { width: 400, quality: 85, format: 'webp' });
            const w700 = window.getOptimizedImageUrl(canonicalUrl, { width: 700, quality: 85, format: 'webp' });
            const w1000 = window.getOptimizedImageUrl(canonicalUrl, { width: 1000, quality: 85, format: 'webp' });
            const w1270 = window.getOptimizedImageUrl(canonicalUrl, { width: 1270, quality: 85, format: 'webp' });

            heroImg.sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 635px';
            heroImg.srcset = `${w400} 400w, ${w700} 700w, ${w1000} 1000w, ${w1270} 1270w`;
            heroImg.src = w700;
        } else {
            heroImg.removeAttribute('srcset');
            heroImg.removeAttribute('sizes');
            heroImg.src = canonicalUrl;
        }

        heroImg.alt = 'Hero Image';
        heroImg.classList.remove('empty');
    } else {
        // Neutral blank image state — do NOT use placeholder.jpg or fake content
        heroImg.removeAttribute('srcset');
        heroImg.removeAttribute('sizes');
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

function placePortfolioSectionTag() {
    const tag = document.getElementById('portfolio-section-tag') || document.querySelector('.portfolio-section .section-tag');
    if (!tag) return;

    // Locate the first actual .portfolio-section in the portfolio group's DOM order
    const firstSection = document.querySelector('main > .portfolio-section, .portfolio-section');
    if (!firstSection) return;

    const targetH2 = firstSection.querySelector('h2');
    if (!targetH2) return;

    // If it is already correctly positioned, perform no unnecessary mutation
    if (tag.parentNode === firstSection && tag.nextElementSibling === targetH2) {
        return;
    }

    // Move the existing label node immediately before that section's h2
    firstSection.insertBefore(tag, targetH2);
}

function createPortfolioItemElement(item) {
    const itemElem = document.createElement('div');
    itemElem.className = 'gallery-item reveal';

    const imgElem = document.createElement('img');
    const canonicalUrl = item.imageUrl ? window.getAbsoluteImageUrl(item.imageUrl) : '';

    // Deliberate loading policy: lazy loading with async decoding
    // All attributes configured BEFORE assigning image source
    imgElem.loading = 'lazy';
    imgElem.decoding = 'async';
    imgElem.alt = item.title || 'Portfolio Image';
    imgElem.width = 371;
    imgElem.height = 208;

    if (canonicalUrl) {
        window.setupImageFallback(imgElem, canonicalUrl);
        itemElem.dataset.fullSrc = canonicalUrl;

        if (window.isSupabaseStorageUrl(canonicalUrl)) {
            const w375 = window.getOptimizedImageUrl(canonicalUrl, { width: 375, quality: 80, format: 'webp' });
            const w750 = window.getOptimizedImageUrl(canonicalUrl, { width: 750, quality: 80, format: 'webp' });
            const w1125 = window.getOptimizedImageUrl(canonicalUrl, { width: 1125, quality: 80, format: 'webp' });

            imgElem.sizes = '(max-width: 768px) 85vw, 375px';
            imgElem.srcset = `${w375} 375w, ${w750} 750w, ${w1125} 1125w`;
            imgElem.src = w750;
        } else {
            imgElem.src = canonicalUrl;
        }
    } else {
        imgElem.src = 'https://via.placeholder.com/400x300?text=Image';
    }

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
    return itemElem;
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

    // Place the portfolio group label above the first section's h2
    placePortfolioSectionTag();

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
                gallery.appendChild(createPortfolioItemElement(item));
            });
        });
    } else {
        // Fallback for single gallery container
        const container = galleries[0];
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        data.portfolio.forEach(item => {
            container.appendChild(createPortfolioItemElement(item));
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
        stars.className = 'feedback-stars rating-stars stars';
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
