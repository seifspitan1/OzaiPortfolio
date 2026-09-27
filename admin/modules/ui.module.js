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

/**
 * Automatically compress and convert any uploaded image to high-efficiency WebP format
 * directly in the browser before sending to the server.
 * This ensures large images (5MB-20MB, 4K artwork, raw PNGs) are scaled and compressed
 * down to ~200KB-800KB without visual quality loss, preventing 4MB payload rejection.
 *
 * @param {File} file Original image file from input
 * @param {number} maxDimension Max width or height (default 2560px for high-definition portfolio art)
 * @param {number} quality WebP quality 0.0 - 1.0 (default 0.88)
 * @returns {Promise<File>} Converted & compressed File object ready for upload
 */
export async function compressAndConvertToWebP(file, maxDimension = 2560, quality = 0.88) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
        return file;
    }

    // Skip SVG or already lightweight WebP (< 600KB)
    if (file.type === 'image/svg+xml') {
        return file;
    }
    if (file.type === 'image/webp' && file.size < 600 * 1024) {
        return file;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
                if (width >= height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return resolve(file);
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const exportQuality = file.size > 8 * 1024 * 1024 ? 0.82 : quality;

            canvas.toBlob((blob) => {
                if (!blob) {
                    return resolve(file);
                }

                const baseName = file.name.replace(/\.[^/.]+$/, "");
                const optimizedFile = new File([blob], `${baseName}.webp`, {
                    type: 'image/webp',
                    lastModified: Date.now()
                });

                console.log(`[Image Optimizer] Input: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type}) -> WebP: ${(optimizedFile.size / 1024).toFixed(1)} KB`);
                resolve(optimizedFile);
            }, 'image/webp', exportQuality);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        img.src = objectUrl;
    });
}
