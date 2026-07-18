/* ── Hero Module ──────────────────────────────
 * Hero section rendering + upload handling.
 * Images stored in IndexedDB via imageStore.
 * ──────────────────────────────────────────── */

import { state, _renderHash, _hashHero } from './state.js';
import { markDirty } from './storage.js';
import { setIsUploading, requestSync } from './api.js';
import { getAbsoluteImageUrl, updateSyncStatus } from './ui.module.js';

let _heroPreview = null;

export async function renderHero() {
    const hash = _hashHero();
    if (hash === _renderHash.hero) return;
    _renderHash.hero = hash;

    if (!_heroPreview) return;

    if (state.hero.imageUrl) {
        _heroPreview.src = getAbsoluteImageUrl(state.hero.imageUrl);
    } else if (state.hero.image) {
        // Legacy fallback
        _heroPreview.src = state.hero.image;
    }
}

export function initHero() {
    _heroPreview = document.getElementById('heroPreview');

    const heroUpload = document.getElementById('heroUpload');

    if (heroUpload) {
        heroUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const name = file.name || 'No file selected';
            const heroFileName = document.getElementById('heroFileName');
            if (heroFileName) heroFileName.textContent = name;

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = ev.target.result;
                const previousSrc = _heroPreview ? _heroPreview.src : '';
                if (_heroPreview) _heroPreview.src = base64; // Optimistic preview

                console.log("UPLOAD START [HERO]");

                const formData = new FormData();
                formData.append('image', file);

                setIsUploading(true);
                try {
                    const res = await fetch('/api/v1/upload', { method: 'POST', body: formData });
                    
                    if (res.status === 401) {
                        if (typeof Auth !== 'undefined') await Auth.logout();
                        window.location.href = 'login.html';
                        return;
                    }

                    if (!res.ok) {
                        throw new Error("Network error");
                    }

                    let data;
                    try {
                        data = await res.json();
                    } catch (e) {
                        throw new Error("Invalid JSON");
                    }

                    console.log("SERVER RESPONSE:", data);

                    if (!data.success || !data.url) {
                        throw new Error(data.error || "Upload failed");
                    }

                    console.log("SETTING STATE: Hero", data.url);

                    state.hero = {
                        ...state.hero,
                        imageUrl: data.url
                    };
                    delete state.hero.image;
                    delete state.hero.imageId;

                    console.log("STATE AFTER:", JSON.stringify(state.hero, null, 2));

                    if (_heroPreview) _heroPreview.src = data.fullUrl || getAbsoluteImageUrl(data.url);
                } catch (err) {
                    console.error('Upload error:', err);
                    updateSyncStatus("Image upload failed ❌", "error");
                    if (_heroPreview) _heroPreview.src = previousSrc;
                }
                
                setIsUploading(false);
                setTimeout(() => requestSync(), 300);

                _renderHash.hero = ''; 
                markDirty();
            };
            reader.readAsDataURL(file);
        });
    }
}
