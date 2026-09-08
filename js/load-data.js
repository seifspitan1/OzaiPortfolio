/**
 * Ozai Portfolio — Public Site Data Loader (Phase 2)
 *
 * Implements deterministic states:
 *   - loading: Neutral loading overlay visible, no fake data rendered
 *   - success: Canonical Supabase data validated, hydrated, and rendered
 *   - empty:   Valid empty arrays handled gracefully with styled empty states
 *   - error:   Accessible alert banner with manual single-click retry mechanism
 *   - demo:    Guarded, opt-in development demo mode (localhost + ?demo=1 only)
 */

function isLocalHost() {
    const host = window.location.hostname;
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(host) || host.endsWith('.local');
}

function isDemoModeRequested() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('demo') === '1' || params.get('demo') === 'true';
    } catch (e) {
        return false;
    }
}

function showLoading() {
    document.body.classList.remove('site-loaded');
    hideError();
}

function hideLoading() {
    document.body.classList.add('site-loaded');
}

function showError(message) {
    hideLoading();
    const errorContainer = document.getElementById('site-error-container');
    if (errorContainer) {
        if (message) {
            const msgSpan = errorContainer.querySelector('.site-error-message span');
            if (msgSpan) msgSpan.textContent = message;
        }
        errorContainer.hidden = false;
    }
}

function hideError() {
    const errorContainer = document.getElementById('site-error-container');
    if (errorContainer) {
        errorContainer.hidden = true;
    }
}

function showDemoBadge() {
    const badge = document.getElementById('site-demo-badge');
    if (badge) {
        badge.hidden = false;
    }
}

async function loadDemoData() {
    showLoading();

    try {
        let mockData = null;
        try {
            const mod = await import('../data/mock-data.js');
            mockData = mod.default || mod.MOCK_DATA;
        } catch (importErr) {
            if (typeof window !== 'undefined' && window.__MOCK_DATA__) {
                mockData = window.__MOCK_DATA__;
            } else {
                throw importErr;
            }
        }

        if (!mockData) {
            throw new Error('Demo data fixture could not be resolved');
        }

        showDemoBadge();

        const demoPayload = {
            version: 2,
            lastModified: Date.now(),
            isDemo: true,
            data: {
                hero: mockData.hero || {},
                portfolio: mockData.portfolio || [],
                feedbacks: mockData.feedbacks || [],
                sections: mockData.sections || []
            }
        };

        window.siteData = demoPayload;

        if (typeof window.renderHero === 'function') {
            window.renderHero(demoPayload.data);
        }
        if (typeof window.renderPortfolio === 'function') {
            window.renderPortfolio(demoPayload.data);
        }
        if (typeof window.renderFeedbacks === 'function') {
            window.renderFeedbacks(demoPayload.data);
        }

        if (typeof window.observeNewReveals === 'function') {
            window.observeNewReveals(document.querySelectorAll('.reveal'));
        }

        document.dispatchEvent(new Event('siteDataLoaded'));
        hideLoading();
    } catch (err) {
        console.error('Failed to load demo data fixture:', err);
        showError('Failed to load local demo data fixture.');
    }
}

async function loadSiteData() {
    // Check for explicit local development demo mode opt-in
    if (isLocalHost() && isDemoModeRequested()) {
        await loadDemoData();
        return;
    }

    showLoading();

    try {
        const res = await fetch('/api/v1/load');
        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }

        const responseData = await res.json();

        // Validate canonical API response structure
        const isValid = responseData &&
            typeof responseData.version !== 'undefined' &&
            typeof responseData.lastModified !== 'undefined' &&
            responseData.data &&
            typeof responseData.data.hero === 'object' &&
            Array.isArray(responseData.data.portfolio) &&
            Array.isArray(responseData.data.feedbacks) &&
            (!responseData.data.sections || Array.isArray(responseData.data.sections));

        if (!isValid) {
            throw new Error('Invalid canonical API response structure');
        }

        // Canonical Hydration
        window.siteData = responseData;

        // Render pipeline
        if (typeof window.renderHero === 'function') {
            window.renderHero(responseData.data);
        }
        if (typeof window.renderPortfolio === 'function') {
            window.renderPortfolio(responseData.data);
        }
        if (typeof window.renderFeedbacks === 'function') {
            window.renderFeedbacks(responseData.data);
        }

        // Re-observe dynamic reveal elements
        if (typeof window.observeNewReveals === 'function') {
            window.observeNewReveals(document.querySelectorAll('.reveal'));
        }

        document.dispatchEvent(new Event('siteDataLoaded'));
        hideLoading();
    } catch (err) {
        console.error('Failed to load canonical site data:', err);
        showError('Unable to load portfolio data. Please check your connection and try again.');
    }
}

function initRetryHandler() {
    const retryBtn = document.getElementById('site-retry-btn');
    if (retryBtn && !retryBtn.dataset.bound) {
        retryBtn.dataset.bound = 'true';
        retryBtn.addEventListener('click', () => {
            loadSiteData();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initRetryHandler();
    loadSiteData();
});
