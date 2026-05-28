/* ── Storage Module ───────────────────────────
 * localStorage persistence layer.
 * Strips Base64 image data — only stores imageId references.
 * Dirty tracking + unified debounced save queue.
 * Imports: state, imageStore (for migration + reset)
 * ──────────────────────────────────────────── */

import { state, STATE_VERSION, sanitizeNetworkState, assignMissingIds } from './state.js';
import { requestSync } from './api.js';

const STORAGE_KEY = 'admin_state_v2';

/* ── Dirty Tracking + Save Queue ──────────── */
let isDirty = false;
let saveTimer = null;
let isSaving = false;

export function markDirty() {
    state.lastModified = Date.now();
    isDirty = true;
    _scheduleSave();
}

export function clearDirtyFlag() {
    isDirty = false;
    clearTimeout(saveTimer);
}

/**
 * Internal debounced scheduler. Coalesces rapid mutations into a single write.
 */
function _scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(_runSave, 500);
}

/**
 * Internal save executor. Skips if nothing is dirty or a save is already in-flight.
 */
function _runSave() {
    if (!isDirty) return;
    if (isSaving) {
        // Re-schedule: a save is in progress, but new mutations arrived
        _scheduleSave();
        return;
    }
    isSaving = true;
    saveStateToStorage();
    requestSync();
    isDirty = false;
    isSaving = false;
}



export function saveStateToStorage() {
    try {
        const safeState = sanitizeNetworkState(state);
        const payload = {
            version: STATE_VERSION,
            lastModified: state.lastModified || Date.now(),
            data: safeState
        };
        const payloadStr = JSON.stringify(payload);
        
        // Crash Recovery: Save backup before replacing main key
        const previousState = localStorage.getItem(STORAGE_KEY);
        if (previousState) {
            localStorage.setItem('admin_state_backup', previousState);
        }

        localStorage.setItem(STORAGE_KEY, payloadStr);
        
        // Remove backup on success
        localStorage.removeItem('admin_state_backup');
    } catch (e) {
        console.error('Storage save failed', e);
    }
}

export async function resetStorage() {
    try {
        clearTimeout(saveTimer);
        isDirty = false;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('admin_state_backup');
        console.warn('Storage reset (localStorage)');
        location.reload();
    } catch (e) {
        console.error('Reset failed', e);
    }
}

export async function loadStateFromStorage() {
    try {
        let raw = localStorage.getItem(STORAGE_KEY);
        
        // Crash Recovery
        if (!raw) {
            const backup = localStorage.getItem('admin_state_backup');
            if (backup) {
                console.warn('Main storage missing. Restoring from backup...');
                raw = backup;
                localStorage.setItem(STORAGE_KEY, backup);
                localStorage.removeItem('admin_state_backup');
            } else {
                return false;
            }
        }
        
        const parsedWrapper = JSON.parse(raw);
        
        // Corrupted State Guard
        if (!parsedWrapper || typeof parsedWrapper !== 'object' || !parsedWrapper.version || !parsedWrapper.data) {
            // Legacy data fallback hook (if missing version wrapper, treat as legacy raw state)
            if (parsedWrapper && typeof parsedWrapper === 'object' && parsedWrapper.hero) {
                console.log('Legacy data detected. Proceeding to migration.');
                // We fake the wrapper to allow it to pass safely into migration
                const fakeData = parsedWrapper;
                parsedWrapper.data = fakeData;
            } else {
                console.warn('Corrupted state detected. Resetting storage...');
                await resetStorage();
                return false;
            }
        }

        const parsed = parsedWrapper.data;

        // Validation limits
        if (!parsed.hero || typeof parsed.hero !== 'object' || !Array.isArray(parsed.portfolio) || !Array.isArray(parsed.feedbacks)) {
            console.warn('Corrupted schema detected. Resetting storage...');
            await resetStorage();
            return false;
        }

        state.hero = { ...state.hero, ...parsed.hero };
        state.portfolio.length = 0;
        state.portfolio.push(...parsed.portfolio);
        state.feedbacks.length = 0;
        state.feedbacks.push(...parsed.feedbacks);
        
        assignMissingIds();

        return true;
    } catch (e) {
        console.warn('Storage load failed', e);
        // Do not instantly reset on generic error, just fallback
        localStorage.removeItem(STORAGE_KEY);
        return false;
    }
}



/* ── Safety: flush on page unload ─────────── */
window.addEventListener('beforeunload', () => {
    if (isDirty) {
        saveStateToStorage();
        isDirty = false;
    }
});
