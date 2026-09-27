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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureUUID(id) {
    return (id && typeof id === 'string' && UUID_REGEX.test(id)) ? id : crypto.randomUUID();
}

export function sanitizeNetworkState(stateObj) {
    if (!stateObj) return stateObj;

    // We explicitly serialize properties to ensure fields like imageUrl are properly persisted
    const cleanHero = {
        id: ensureUUID(stateObj.hero?.id),
        imageUrl: stateObj.hero?.imageUrl || ''
    };

    // Filter out draft projects without an image so incomplete drafts do not break sync
    const cleanPortfolio = (stateObj.portfolio || [])
        .filter(p => p.imageUrl && typeof p.imageUrl === 'string' && p.imageUrl.trim() !== '')
        .map((p, idx) => {
            // Accurately map section name to match the target section title
            let sectionName = p.section;
            if (p.sectionId && Array.isArray(stateObj.sections)) {
                const matchedSec = stateObj.sections.find(s => s.id === p.sectionId);
                if (matchedSec && matchedSec.title) {
                    sectionName = matchedSec.title;
                }
            }
            if (!sectionName && Array.isArray(stateObj.sections) && stateObj.sections.length > 0) {
                sectionName = stateObj.sections[0].title;
            }
            if (!sectionName) {
                sectionName = 'Cartoon Roblox Studio';
            }

            return {
                id: ensureUUID(p.id),
                order: typeof p.order === 'number' && p.order > 0 ? p.order : idx + 1,
                title: p.title || '',
                description: p.description || '',
                link: p.link || '',
                imageUrl: p.imageUrl.trim(),
                section: sectionName
            };
        });

    const cleanFeedbacks = (stateObj.feedbacks || []).map((f, idx) => {
        return {
            id: ensureUUID(f.id),
            order: typeof f.order === 'number' && f.order > 0 ? f.order : idx + 1,
            clientName: f.clientName || '',
            text: f.text || '',
            rating: typeof f.rating === 'number' && f.rating >= 1 && f.rating <= 5 ? f.rating : 5,
            imageUrl: f.imageUrl || ''
        };
    });

    const cleanSections = (stateObj.sections || []).map((s, idx) => {
        return {
            id: s.id || `sec-${idx + 1}`,
            title: s.title || `Section ${idx + 1}`,
            order: typeof s.order === 'number' && s.order > 0 ? s.order : idx + 1
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
