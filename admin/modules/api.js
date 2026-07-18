/* ── API Module ───────────────────────────────
 * Server communication layer with retry + abort.
 * Now handles background auto-sync loop.
 * ──────────────────────────────────────────── */

import { state, sanitizeNetworkState } from './state.js';
import { updateSyncStatus } from './ui.module.js';

const API_BASE = '/api/v1';
const ENDPOINT_SAVE = '/save';
const ENDPOINT_LOAD = '/load';

/* ── API Hardening Flags ───────────────────── */
let isSaving = false;
let loadController = null;
const RETRY_LIMIT = 2;
const RETRY_BASE_DELAY = 500;

/* ── Auto Sync Queue ───────────────────────── */
export let isUploading = false;
export function setIsUploading(val) {
    isUploading = val;
}

let isSyncing = false;
let pendingSync = false;
let lastSuccessfulPayloadDataStr = null;

export function clearPendingSync() {
    pendingSync = false;
}

export function requestSync() {
    console.log("REQUEST SYNC TRIGGERED");
    pendingSync = true;
    processQueue();
}

function isValidPayload(payload) {
    if (!payload || !payload.data) return false;
    const hero = payload.data.hero;
    if (!hero || !hero.imageUrl || hero.imageUrl.trim() === '') {
        return false;
    }
    const portfolio = payload.data.portfolio;
    if (Array.isArray(portfolio)) {
        for (const item of portfolio) {
            if (!item.imageUrl || item.imageUrl.trim() === '') {
                return false;
            }
        }
    }
    const feedbacks = payload.data.feedbacks;
    if (Array.isArray(feedbacks)) {
        for (const item of feedbacks) {
            if (!item.clientName || item.clientName.trim() === '') return false;
            if (!item.text || item.text.trim() === '') return false;
            if (typeof item.rating !== 'number' || item.rating < 1 || item.rating > 5) return false;
        }
    }
    return true;
}

async function processQueue() {
    if (isSyncing) return;
    if (!pendingSync) return;
    if (isUploading) return;

    const payload = { version: 2, lastModified: state.lastModified || Date.now(), data: sanitizeNetworkState(state) };

    if (!isValidPayload(payload)) {
        console.warn('Skipping server sync: state payload contains missing or invalid required fields.');
        return;
    }

    const currentPayloadDataStr = JSON.stringify(payload.data);
    if (currentPayloadDataStr === lastSuccessfulPayloadDataStr) {
        console.log('Skipping sync: payload data is identical to the last successful sync.');
        pendingSync = false;
        return;
    }

    isSyncing = true;
    pendingSync = false;

    updateSyncStatus('Syncing...', 'syncing');
    
    console.log("SYNC PAYLOAD:", payload);

    const res = await saveToServer(payload);
    
    if (res && res.success) {
        lastSuccessfulPayloadDataStr = currentPayloadDataStr;
        updateSyncStatus('All changes saved', 'success', true);
    } else {
        updateSyncStatus('Sync failed', 'error');
    }

    isSyncing = false;

    if (pendingSync) processQueue();
}

export function getIsSaving() {
    return isSaving;
}

export function isValidServerData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.data || typeof data.data !== 'object') return false;
    if (data.data.hero && typeof data.data.hero !== 'object') return false;
    if (data.data.portfolio && !Array.isArray(data.data.portfolio)) return false;
    if (data.data.feedbacks && !Array.isArray(data.data.feedbacks)) return false;
    return true;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export async function saveToServer(payload) {
    if (isSaving) {
        console.warn('Save already in progress, skipping');
        return null;
    }

    const payloadString = JSON.stringify(payload);
    if (payloadString.length > 300 * 1024) { // Update to 300KB limit as per security review limit
        console.error('Payload exceeds maximum size limit (300KB). Aborting network save to protect server.');
        return null;
    }

    isSaving = true;
    console.log("PAYLOAD:", sanitizeNetworkState(state));

    const idempotencyKey = generateUUID();

    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
        try {
            const res = await fetch(API_BASE + ENDPOINT_SAVE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey
                },
                body: payloadString
            });

            if (res.status === 401) {
                if (typeof Auth !== 'undefined') await Auth.logout();
                window.location.href = 'login.html';
                return null;
            }

            if (res.status === 409) {
                const errData = await res.json();
                alert(errData.error || 'Conflict: Outdated data. Page will reload.');
                window.location.reload();
                return null;
            }

            if (!res.ok) {
                if (res.status >= 500 && res.status < 600) {
                    throw new Error(`Server error: ${res.status}`);
                } else {
                    console.error(`Non-retryable HTTP error ${res.status}`);
                    isSaving = false;
                    return null;
                }
            }

            isSaving = false;
            const resData = await res.json();
            // Sync client lastModified with server timestamp
            if (resData && resData.savedAt) {
                state.lastModified = resData.savedAt;
            }
            return resData;
        } catch (err) {
            console.error(`API Save Error (attempt ${attempt + 1}/${RETRY_LIMIT + 1}):`, err);

            if (attempt < RETRY_LIMIT) {
                const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
                console.log(`Retrying save in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    isSaving = false;
    return null;
}

export async function loadFromServer() {
    // Cancel any in-flight load request
    if (loadController) {
        loadController.abort();
    }
    loadController = new AbortController();

    try {
        const res = await fetch(API_BASE + ENDPOINT_LOAD, {
            signal: loadController.signal
        });

        if (!res.ok) throw new Error('Load failed');

        const serverData = await res.json();
        if (serverData && serverData.data) {
            lastSuccessfulPayloadDataStr = JSON.stringify(serverData.data);
        }
        return serverData;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('Load request cancelled (superseded)');
            return null;
        }
        console.error('API Load Error:', err);
        return null;
    } finally {
        loadController = null;
    }
}
