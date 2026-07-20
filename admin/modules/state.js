/* ── State Module ─────────────────────────────
 * Single source of truth + render hash guards.
 * No imports — this is the root of the dependency tree.
 * ──────────────────────────────────────────── */

export const STATE_VERSION = 1;

export const state = {
    hero: {
        image: '',
        imageId: ''
    },
    portfolio: [],
    feedbacks: []
};

/* ── Render Hash Guards ────────────────────── */
export const _renderHash = { hero: '', portfolio: '', feedbacks: '' };

export function _hashHero() {
    return state.hero.imageUrl || state.hero.image || '';
}

export function _hashPortfolio() {
    return state.portfolio.map(p => `${p.order}|${p.title}|${p.section || 'Section 1'}|${p.imageUrl || p.image || ''}`).join(';;');
}

export function _hashFeedbacks() {
    return state.feedbacks.map(f => `${f.order}|${f.clientName}|${f.text}|${f.rating}|${f.imageUrl || f.image || ''}`).join(';;');
}

/* ── Utility Functions ─────────────────────── */

export function sanitizeNetworkState(stateObj) {
    if (!stateObj) return stateObj;

    // We explicitly serialize properties to ensure fields like imageUrl are properly persisted
    const cleanHero = {
        id: stateObj.hero.id || '',
        imageUrl: stateObj.hero.imageUrl || ''
    };

    const cleanPortfolio = stateObj.portfolio.map(p => {
        return {
            id: p.id || '',
            order: p.order || 0,
            title: p.title || '',
            description: p.description || '',
            link: p.link || '',
            imageUrl: p.imageUrl || '',
            section: p.section || 'Section 1'
        };
    });

    const cleanFeedbacks = stateObj.feedbacks.map(f => {
        return {
            id: f.id || '',
            order: f.order || 0,
            clientName: f.clientName || '',
            text: f.text || '',
            rating: f.rating || 0,
            imageUrl: f.imageUrl || ''
        };
    });

    return {
        hero: cleanHero,
        portfolio: cleanPortfolio,
        feedbacks: cleanFeedbacks
    };
}

let _idsAssigned = false;
export function assignMissingIds() {
    if (_idsAssigned) return;
    if (state.hero && !state.hero.id) state.hero.id = crypto.randomUUID();
    state.portfolio.forEach(p => { if (!p.id) p.id = crypto.randomUUID(); });
    state.feedbacks.forEach(f => { if (!f.id) f.id = crypto.randomUUID(); });
    _idsAssigned = true;
}
