/* ── UI Utilities Module ──────────────────────
 * Shared DOM helpers: sync status, DOM clearing.
 * No internal module imports — standalone.
 * ──────────────────────────────────────────── */

export function updateSyncStatus(text, type, autoFade = false, restoreBtn = null) {
    const el = document.getElementById('saveStatus');
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    el.dataset.syncType = type || '';

    if (autoFade) {
        setTimeout(() => {
            const statusEl = document.getElementById('saveStatus');
            if (statusEl && statusEl.dataset.syncType !== 'offline') {
                statusEl.textContent = '';
            }
        }, 4000);
    }
    
    if (restoreBtn) {
        setTimeout(() => {
            restoreBtn.btn.textContent = restoreBtn.originalText;
        }, 2500);
    }
}

export function clearChildren(el) {
    while (el.lastChild) el.removeChild(el.lastChild);
}

export function getAbsoluteImageUrl(storedPath) {
    if (!storedPath) return '';
    if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) return storedPath;
    
    if (storedPath.startsWith('/uploads/')) {
        storedPath = storedPath.substring(1);
    }
    
    const pathname = window.location.pathname;
    const adminIndex = pathname.indexOf('/admin');
    const basePath = adminIndex !== -1 ? pathname.substring(0, adminIndex) : '';
    
    return window.location.origin + basePath + '/' + storedPath;
}
