/**
 * Ozai Portfolio — Development/Demo Mockup Data Fixture
 *
 * This file preserves the original hardcoded mockup content that was
 * previously embedded directly in index.html. It is NOT loaded in the
 * normal production path.
 *
 * Purpose:
 *   - Available for future development/demo fallback (Phase 2+)
 *   - Preserves the original mockup values without semantic changes
 *
 * Rules:
 *   - Must NOT be loaded before the canonical API request
 *   - Must NOT overwrite valid API data (window.siteData)
 *   - Must NOT be persisted to Supabase
 *   - Must NOT be written to production localStorage
 *   - Must NOT be added to the public production script loading path
 */

const MOCK_DATA = {
    hero: {
        imageUrl: 'assets/images/placeholder.jpg'
    },
    portfolio: [],
    feedbacks: [
        {
            clientName: 'Astral Studios',
            text: "Ozai delivered an incredible thumbnail that tripled our game's click-through rate overnight. Absolutely blown away by the quality.",
            rating: 5
        },
        {
            clientName: 'PixelForge Dev',
            text: "Best GFX designer I've worked with on Roblox. Fast turnaround, clean communication, and premium results every single time.",
            rating: 5
        },
        {
            clientName: 'NovaCraft Games',
            text: "Our group logo and banners look insanely professional now. Ozai took our rough ideas and turned them into something next-level.",
            rating: 5
        },
        {
            clientName: 'Horizon Interactive',
            text: "Hired Ozai for a full rebrand — thumbnails, banners, the works. The attention to detail and cinematic quality is unmatched.",
            rating: 4
        },
        {
            clientName: 'Revenant Studios',
            text: "I've commissioned over 20 pieces and they just keep getting better. Ozai genuinely cares about making your vision come to life.",
            rating: 5
        },
        {
            clientName: 'Apex Esports',
            text: "Clean, bold, premium — exactly what we needed for our competitive gaming brand. Would recommend Ozai to any serious studio.",
            rating: 5
        }
    ]
};

// Expose for explicit browser dynamic import and node environments
if (typeof window !== 'undefined') {
    window.__MOCK_DATA__ = MOCK_DATA;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MOCK_DATA;
}

export default MOCK_DATA;
export { MOCK_DATA };
