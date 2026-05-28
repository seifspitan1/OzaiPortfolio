/* ── Main Entry Point ─────────────────────────
 * Boot sequence, global listeners, module init.
 * ──────────────────────────────────────────── */

/* ── Auth Guard (runs immediately) ─────────── */
if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    throw new Error('Unauthorized access blocked');
}

/* ── Module Imports ────────────────────────── */
import { state, sanitizeNetworkState, assignMissingIds } from './modules/state.js';
import { saveStateToStorage, loadStateFromStorage, resetStorage, markDirty, clearDirtyFlag } from './modules/storage.js';
import { loadFromServer, isValidServerData, getIsSaving, clearPendingSync, requestSync } from './modules/api.js';
import { updateSyncStatus } from './modules/ui.module.js';
import { renderHero, initHero } from './modules/hero.module.js';
import { renderPortfolio, initPortfolio } from './modules/portfolio.module.js';
import { renderFeedbacks, initFeedbacks } from './modules/feedback.module.js';

/* ── DOMContentLoaded ──────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

    /* ── Periodic Auth Check ────────────────── */
    setInterval(() => {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
        }
    }, 30000);

    /* ── Control Layers ────────────────────── */
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (typeof Auth !== 'undefined') {
                Auth.logout();
            } else {
                localStorage.removeItem('adminAuth');
            }
            window.location.href = 'login.html';
        });
    }

    document.getElementById('reset-btn')?.addEventListener('click', () => {
        const confirmReset = confirm('This will clear all saved data. Continue?');
        if (confirmReset) resetStorage();
    });

    /* ── Tab Switching ─────────────────────── */
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    /* ── Initialize Feature Modules ────────── */
    initHero();
    initPortfolio();
    initFeedbacks();

    /* ── Global Save Button ────────────────── */
    const saveBtn = document.getElementById('saveAll');
    const status = document.getElementById('saveStatus');

    if (saveBtn) {
        const saveBtnOriginalText = saveBtn.textContent;

        saveBtn.addEventListener('click', async () => {
            console.log("STATE TRACE:", JSON.stringify(state.portfolio));
            if (getIsSaving()) return;

            // Optimistic: save to localStorage immediately (non-blocking)
            saveStateToStorage();

            // Override any pending background sync
            clearPendingSync();

            // Use the single source of truth queued sync
            requestSync();
            
            // UX: immediate button feedback
            saveBtn.textContent = 'Sync requested';
            updateSyncStatus('Syncing...', 'syncing');
            setTimeout(() => {
                saveBtn.textContent = saveBtnOriginalText;
            }, 2000);
        });
    }

    // click saveStatus to manually retry sync when failed
    const saveStatusEl = document.getElementById('saveStatus');
    if (saveStatusEl) {
        saveStatusEl.addEventListener('click', () => {
            if (saveStatusEl.dataset.syncType === 'error') {
                updateSyncStatus('Retrying sync...', 'syncing');
                requestSync();
            }
        });
        saveStatusEl.style.cursor = 'pointer';
    }

    /* ── Boot: Server-first, localStorage fallback ── */
    document.body.classList.add('loading');

    (async () => {
        let bootedFromServer = false;
        let requiresSyncOut = false;

        try {
            const serverData = await loadFromServer();
            
            let localData = null;
            const localRaw = localStorage.getItem('admin_state_v2');
            if (localRaw) {
                try { localData = JSON.parse(localRaw); } catch(e) {}
            }

            const serverTS = (serverData && isValidServerData(serverData)) ? (serverData.lastModified || 0) : 0;
            const localTS = (localData && localData.data) ? (localData.lastModified || 0) : 0;

            if (serverTS >= localTS && serverTS > 0) {
                console.log('Server data is the source of truth (equal or newer):', serverData);
                state.hero = { ...state.hero, ...serverData.data.hero };
                state.portfolio.length = 0;
                if (Array.isArray(serverData.data.portfolio)) state.portfolio.push(...serverData.data.portfolio);
                state.feedbacks.length = 0;
                if (Array.isArray(serverData.data.feedbacks)) state.feedbacks.push(...serverData.data.feedbacks);
                assignMissingIds();
                saveStateToStorage(); // sync local backup
                bootedFromServer = true;
            } else if (localTS > serverTS) {
                console.warn('Local cache is newer than server data. Using local and pushing to server.');
                await loadStateFromStorage();
                requiresSyncOut = true;
            } else {
                console.warn('No valid data anywhere or server failed. Checking fallback.');
                await loadStateFromStorage();
            }
        } catch (err) {
            console.error('Boot load error:', err);
            await loadStateFromStorage();
        }

        await renderHero();
        await renderPortfolio();
        renderFeedbacks();

        document.body.classList.remove('loading');

        if (bootedFromServer) {
            updateSyncStatus('All changes saved', 'success');
        } else if (requiresSyncOut) {
            requestSync();
        }
    })();

    /* ── Network Status Listeners ───────────── */
    window.addEventListener('online', () => {
        console.log('Online mode restored, scheduling auto-sync');
        updateSyncStatus('Back online, syncing...', 'syncing');
        requestSync();
    });

    window.addEventListener('offline', () => {
        console.warn('Offline mode enabled');
        updateSyncStatus('Offline mode', 'offline');
    });
});
