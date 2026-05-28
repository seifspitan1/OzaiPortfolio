/* ── API Module ───────────────────────────────
 * Server communication layer with retry + abort.
 * Now handles background auto-sync loop.
 * ──────────────────────────────────────────── */

import { state, sanitizeNetworkState } from './state.js';
import { updateSyncStatus } from './ui.module.js';

const API_BASE = '../api';
const ENDPOINT_SAVE = '/save.php';
const ENDPOINT_LOAD = '/load.php';

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

export function clearPendingSync() {
    pendingSync = false;
}

export function requestSync() {
    console.log("REQUEST SYNC TRIGGERED");
    pendingSync = true;
    processQueue();
}

async function processQueue() {
    if (isSyncing) return;
    if (!pendingSync) return;
    if (isUploading) return;

    isSyncing = true;
    pendingSync = false;

    updateSyncStatus('Syncing...', 'syncing');
    const payload = { version: 2, lastModified: state.lastModified || Date.now(), data: sanitizeNetworkState(state) };
    
    console.log("SYNC PAYLOAD:", payload);

    const res = await saveToServer(payload);
    
    if (res && res.success) {
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

export async function saveToServer(payload) {
    if (isSaving) {
        console.warn('Save already in progress, skipping');
        return null;
    }

    const payloadString = JSON.stringify(payload);
    if (payloadString.length > 200 * 1024) { // 200KB limit check
        console.error('Payload exceeds maximum size limit (200KB). Aborting network save to protect server.');
        return null; // Will fallback gracefully offline
    }

    isSaving = true;
    console.log("PAYLOAD:", sanitizeNetworkState(state));

    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
        try {
            const res = await fetch(API_BASE + ENDPOINT_SAVE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: payloadString
            });

            if (res.status === 401) {
                if (typeof Auth !== 'undefined') Auth.logout();
                window.location.href = 'login.html';
                return null;
            }

            if (!res.ok) throw new Error('Save failed');

            isSaving = false;
            return await res.json();
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
