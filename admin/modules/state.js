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
    feedbacks: [],
    sections: []
};

/* ── Render Hash Guards ────────────────────── */
export const _renderHash = { hero: '', portfolio: '', feedbacks: '', sections: '' };

export function _hashHero() {
    return state.hero.imageUrl || state.hero.image || '';
}

export function _hashPortfolio() {
    const secHash = (state.sections || []).map(s => `${s.id}:${s.title}:${s.order}`).join(';');
    const portHash = state.portfolio.map(p => `${p.order}|${p.title}|${p.section || 'Section 1'}|${p.imageUrl || p.image || ''}`).join(';;');
    return `${secHash}:::${portHash}`;
}

export function _hashFeedbacks() {
    return state.feedbacks.map(f => `${f.order}|${f.clientName}|${f.text}|${f.rating}|${f.imageUrl || f.image || ''}`).join(';;');
}

export function _hashSections() {
    return (state.sections || []).map(s => `${s.id}|${s.order}|${s.title}`).join(';;');
}

/* ── Utility Functions ─────────────────────── */

export function sanitizeNetworkState(stateObj) {
    if (!stateObj) return stateObj;

    // We explicitly serialize properties to ensure fields like imageUrl are properly persisted
    const cleanHero = {
        id: stateObj.hero.id || '',
        imageUrl: stateObj.hero.imageUrl || ''
    };

    const cleanPortfolio = (stateObj.portfolio || []).map(p => {
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

    const cleanFeedbacks = (stateObj.feedbacks || []).map(f => {
        return {
            id: f.id || '',
            order: f.order || 0,
            clientName: f.clientName || '',
            text: f.text || '',
            rating: f.rating || 0,
            imageUrl: f.imageUrl || ''
        };
    });

    const cleanSections = (stateObj.sections || []).map((s, idx) => {
        return {
            id: s.id || `sec-${idx + 1}`,
            title: s.title || `Section ${idx + 1}`,
            order: s.order || idx + 1
        };
    });

    return {
        hero: cleanHero,
        portfolio: cleanPortfolio,
        feedbacks: cleanFeedbacks,
        sections: cleanSections
    };
}

let _idsAssigned = false;
export function assignMissingIds() {
    if (_idsAssigned) return;
    if (state.hero && !state.hero.id) state.hero.id = crypto.randomUUID();
    state.portfolio.forEach(p => { if (!p.id) p.id = crypto.randomUUID(); });
    state.feedbacks.forEach(f => { if (!f.id) f.id = crypto.randomUUID(); });
    if (Array.isArray(state.sections)) {
        state.sections.forEach((s, idx) => { if (!s.id) s.id = `sec-${idx + 1}`; });
    }
    _idsAssigned = true;
}
