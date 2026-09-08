async function loadSiteData() {
    try {
        const res = await fetch('/api/v1/load');
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const responseData = await res.json();
        
        // Validate API Response
        if (!responseData || typeof responseData.version === 'undefined' || typeof responseData.lastModified === 'undefined' || !responseData.data || !responseData.data.hero || !responseData.data.portfolio || !responseData.data.feedbacks) {
            console.error('Invalid API response structure', responseData);
            document.body.classList.add('site-loaded');
            return;
        }
        
        // Debug panel
        console.log("Loaded Data:", responseData);
        
        window.siteData = responseData;
        
        // Connect Render Pipeline
        if (typeof window.renderHero === 'function') {
            window.renderHero(responseData.data);
            window.renderPortfolio(responseData.data);
            window.renderFeedbacks(responseData.data);
        }
        
        // Re-observe newly injected dynamic reveal elements
        if (typeof window.observeNewReveals === 'function') {
            window.observeNewReveals(document.querySelectorAll('.reveal'));
        }
        
        document.dispatchEvent(new Event('siteDataLoaded'));

        // Phase 1: Dismiss loading overlay after canonical data has been rendered
        document.body.classList.add('site-loaded');
    } catch (err) {
        console.error('Failed to load site data', err);
        // Dismiss loading overlay to prevent permanent blocking (Phase 2 will add error UX)
        document.body.classList.add('site-loaded');
    }
}

document.addEventListener('DOMContentLoaded', loadSiteData);
