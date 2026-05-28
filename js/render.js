window.getAbsoluteImageUrl = function(storedPath) {
    if (!storedPath) return '';
    if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) return storedPath;
    
    if (storedPath.startsWith('/uploads/')) {
        storedPath = storedPath.substring(1);
    }
    
    const pathname = window.location.pathname;
    let basePath = pathname.replace(/\/[^\/]*$/, '');
    
    return window.location.origin + basePath + '/' + storedPath;
};

window.renderHero = function(data) {
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

window.renderPortfolio = function(data) {
    if (!data || !data.portfolio) return;
    const container = document.querySelector('.gallery');
    if (!container) return;
    
    // Clear existing items
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    data.portfolio.forEach(item => {
        // Create DOM card
        const linkElem = document.createElement('a');
        linkElem.href = item.link || '#';
        linkElem.className = 'gallery-item reveal';
        linkElem.target = '_blank';
        linkElem.rel = 'noopener';
        
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
        
        // As per previous instruction, description can be added if needed,
        // but current UI design has title under the image. We'll add description as title attribute,
        // or just rely on title as requested.
        if (item.description) {
            linkElem.title = item.description;
        }
        
        linkElem.appendChild(imgElem);
        linkElem.appendChild(textElem);
        container.appendChild(linkElem);
    });
};

window.renderFeedbacks = function(data) {
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
        
        const stars = document.createElement('div');
        stars.className = 'feedback-stars';
        const rating = item.rating || 5;
        stars.setAttribute('aria-label', `${rating} out of 5 stars`);
        stars.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        
        const textElem = document.createElement('p');
        textElem.className = 'feedback-text';
        textElem.textContent = `"${item.text || ''}"`;
        
        const clientElem = document.createElement('span');
        clientElem.className = 'feedback-client';
        clientElem.textContent = `— ${item.clientName || 'Anonymous'}`;
        
        article.appendChild(stars);
        article.appendChild(textElem);
        article.appendChild(clientElem);
        container.appendChild(article);
    });
};
