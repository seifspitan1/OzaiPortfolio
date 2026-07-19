/* ── Portfolio Module ─────────────────────────
 * Portfolio rendering + event delegation.
 * Images stored in IndexedDB via imageStore.
 * ──────────────────────────────────────────── */

import { state, _renderHash, _hashPortfolio } from './state.js';
import { markDirty } from './storage.js';
import { setIsUploading, requestSync } from './api.js';
import { getAbsoluteImageUrl, updateSyncStatus } from './ui.module.js';

let portfolioContainer = null;
let projectTpl = null;

export async function renderPortfolio() {
    if (!portfolioContainer || !projectTpl) return;

    console.log("RENDER SOURCE:", JSON.stringify(state.portfolio, null, 2));

    const hash = _hashPortfolio();
    if (hash === _renderHash.portfolio) return;
    _renderHash.portfolio = hash;

    if (state.portfolio.length === 0) {
        portfolioContainer.innerHTML = `<div class="empty-state">No projects added yet.</div>`;
        return;
    }

    const emptyState = portfolioContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const domNodes = new Map();
    Array.from(portfolioContainer.children).forEach(child => {
        const id = child.dataset.id;
        if (id) {
            if (!state.portfolio.find(p => p.id === id)) {
                child.remove();
            } else {
                domNodes.set(id, child);
            }
        }
    });

    state.portfolio.forEach((proj, index) => {
        let card = domNodes.get(proj.id);
        
        if (!card) {
            const clone = projectTpl.content.cloneNode(true);
            card = clone.querySelector('.item-card');
            card.dataset.id = proj.id;
            portfolioContainer.appendChild(clone);
            card = portfolioContainer.lastElementChild;
            domNodes.set(proj.id, card);
            
            const imgNode = card.querySelector('.projectPreview');
        }

        const imgNode = card.querySelector('.projectPreview');
        if (imgNode) {
            const newSrc = proj.imageUrl
                ? getAbsoluteImageUrl(proj.imageUrl)
                : (proj.image || '');

            if (imgNode.src !== newSrc) {
                imgNode.src = newSrc;
            }
        }

        if (portfolioContainer.children[index] !== card && card) {
            portfolioContainer.insertBefore(card, portfolioContainer.children[index]);
        }

        const sectionNode = card.querySelector('.project-section');
        if (sectionNode && sectionNode.value !== (proj.section || 'Section 1')) {
            sectionNode.value = proj.section || 'Section 1';
        }

        const titleNode = card.querySelector('.project-title');
        if (titleNode && titleNode.value !== proj.title) titleNode.value = proj.title;

        const linkNode = card.querySelector('.project-link');
        if (linkNode && linkNode.value !== proj.link) linkNode.value = proj.link;

        const descNode = card.querySelector('.project-description');
        if (descNode && descNode.value !== proj.description) descNode.value = proj.description || '';

        const orderNode = card.querySelector('.item-index');
        if (orderNode && orderNode.textContent != proj.order) orderNode.textContent = proj.order;
    });
}

export function initPortfolio() {
    portfolioContainer = document.getElementById('portfolio-items');
    projectTpl = document.getElementById('tpl-project-item');
    const addProjectBtn = document.getElementById('add-project-btn');

    if (!addProjectBtn || !portfolioContainer || !projectTpl) return;

    const handleInputOrChange = e => {
        const card = e.target.closest('.item-card');
        if (!card || !card.dataset.id) return;
        const proj = state.portfolio.find(p => p.id === card.dataset.id);
        if (!proj) return;

        if (e.target.classList.contains('project-title')) {
            proj.title = e.target.value;
        } else if (e.target.classList.contains('project-link')) {
            proj.link = e.target.value;
        } else if (e.target.classList.contains('project-description')) {
            proj.description = e.target.value;
        } else if (e.target.classList.contains('project-section')) {
            proj.section = e.target.value;
        }
        markDirty();
    };

    portfolioContainer.addEventListener('input', handleInputOrChange);
    portfolioContainer.addEventListener('change', handleInputOrChange);

    portfolioContainer.addEventListener('click', async (e) => {
        const card = e.target.closest('.item-card');
        if (!card || !card.dataset.id) return;
        const index = state.portfolio.findIndex(p => p.id === card.dataset.id);
        if (index === -1) return;

        if (e.target.closest('.delete-item')) {
            const proj = state.portfolio[index];
            state.portfolio.splice(index, 1);
            state.portfolio.forEach((p, i) => p.order = i + 1);
            _renderHash.portfolio = ''; 
            renderPortfolio();
            markDirty();
        } else if (e.target.closest('.move-up') && index > 0) {
            const temp = state.portfolio[index];
            state.portfolio[index] = state.portfolio[index - 1];
            state.portfolio[index - 1] = temp;
            state.portfolio.forEach((p, i) => p.order = i + 1);
            _renderHash.portfolio = '';
            renderPortfolio();
            markDirty();
        } else if (e.target.closest('.move-down') && index < state.portfolio.length - 1) {
            const temp = state.portfolio[index];
            state.portfolio[index] = state.portfolio[index + 1];
            state.portfolio[index + 1] = temp;
            state.portfolio.forEach((p, i) => p.order = i + 1);
            _renderHash.portfolio = '';
            renderPortfolio();
            markDirty();
        }
    });

    portfolioContainer.addEventListener('change', e => {
        if (e.target.classList.contains('projectImageUpload')) {
            const card = e.target.closest('.item-card');
            if (!card || !card.dataset.id) return;
            const cardId = card.dataset.id;
            
            const file = e.target.files[0];
            if (!file) return;

            console.log("UPLOAD START");

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = ev.target.result;
                
                const imgNode = card.querySelector('.projectPreview');
                const previousSrc = imgNode ? imgNode.src : '';
                if (imgNode) imgNode.src = base64; // Optimistic preview

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

                    const index = state.portfolio.findIndex(p => p.id === cardId);
                    if (index === -1) {
                        setIsUploading(false);
                        return;
                    }

                    console.log("SETTING STATE:", index, data.url);

                    state.portfolio[index] = {
                        ...state.portfolio[index],
                        imageUrl: data.url
                    };
                    delete state.portfolio[index].image;
                    delete state.portfolio[index].imageId;

                    console.log("STATE AFTER:", JSON.stringify(state.portfolio, null, 2));

                    if (imgNode) imgNode.src = data.fullUrl || getAbsoluteImageUrl(data.url);
                } catch (err) {
                    console.error('Upload error:', err);
                    updateSyncStatus("Image upload failed ❌", "error");
                    if (imgNode) imgNode.src = previousSrc;
                }

                setIsUploading(false);
                setTimeout(() => requestSync(), 300);

                _renderHash.portfolio = '';
                markDirty();
            };
            reader.readAsDataURL(file);
        }
    });

    addProjectBtn.addEventListener('click', () => {
        state.portfolio.push({
            id: crypto.randomUUID(),
            order: state.portfolio.length + 1,
            title: '',
            description: '',
            link: '',
            image: '',
            imageId: '',
            section: 'Section 1'
        });
        _renderHash.portfolio = '';
        renderPortfolio();
        markDirty();
    });
}
