/* ── Portfolio Module ─────────────────────────
 * Canonical Portfolio Sections & Project Management.
 * Stable section IDs, title persistence, and order synchronization.
 * Intra-section project reordering & inter-section card reordering.
 * Images stored/uploaded via /api/v1/upload.
 * ──────────────────────────────────────────── */

import { state, _renderHash, _hashPortfolio } from './state.js';
import { markDirty } from './storage.js';
import { setIsUploading, requestSync } from './api.js';
import { getAbsoluteImageUrl, updateSyncStatus } from './ui.module.js';

let portfolioContainer = null;
let projectTpl = null;

export const DEFAULT_SECTIONS = [
    { id: 'sec-1', title: 'Cartoon Roblox Studio', order: 1 },
    { id: 'sec-2', title: 'Semi Realistic', order: 2 },
    { id: 'sec-3', title: 'Realistic', order: 3 }
];

const collapsedSections = new Set();

let draggedItemType = null; // 'section' or 'project'
let draggedSectionId = null;
let draggedSectionName = null;
let draggedProjectId = null;

/**
 * Ensures state.sections contains valid canonical section records.
 * Seeds from DEFAULT_SECTIONS if empty or uninitialized.
 */
export function ensureSectionsInitialized() {
    if (!Array.isArray(state.sections) || state.sections.length === 0) {
        state.sections = DEFAULT_SECTIONS.map(s => ({ ...s }));
    }

    // Ensure all sections have id, title, and positive order
    state.sections.forEach((sec, idx) => {
        if (!sec.id) sec.id = `sec-${idx + 1}`;
        if (!sec.title) sec.title = `Section ${idx + 1}`;
        if (typeof sec.order !== 'number' || sec.order < 1) sec.order = idx + 1;
    });

    state.sections.sort((a, b) => a.order - b.order);
}

/**
 * Re-indexes state.portfolio based on canonical state.sections and relative project order.
 * Ensures `order` numbers (1..N) reflect section ordering + intra-section project ordering.
 */
export function syncPortfolioStateOrders() {
    ensureSectionsInitialized();

    // Group projects by section (matching by stable sectionId or title for backward compatibility)
    const grouped = {};
    state.sections.forEach(sec => { grouped[sec.id] = []; });
    const unassigned = [];

    state.portfolio.forEach(p => {
        let matchedSec = state.sections.find(s => s.id === p.sectionId);
        if (!matchedSec && p.section) {
            matchedSec = state.sections.find(s => s.title === p.section);
        }
        if (!matchedSec && state.sections.length > 0) {
            matchedSec = state.sections[0];
        }

        if (matchedSec) {
            p.sectionId = matchedSec.id;
            p.section = matchedSec.title;
            grouped[matchedSec.id].push(p);
        } else {
            unassigned.push(p);
        }
    });

    // Reconstruct flattened state.portfolio with updated order property
    const newPortfolio = [];
    let currentOrder = 1;

    state.sections.forEach(sec => {
        const projects = grouped[sec.id] || [];
        projects.forEach(p => {
            p.sectionId = sec.id;
            p.section = sec.title;
            p.order = currentOrder++;
            newPortfolio.push(p);
        });
    });

    unassigned.forEach(p => {
        p.order = currentOrder++;
        newPortfolio.push(p);
    });

    state.portfolio.length = 0;
    state.portfolio.push(...newPortfolio);
}

export async function renderPortfolio() {
    if (!portfolioContainer || !projectTpl) return;

    ensureSectionsInitialized();
    syncPortfolioStateOrders();

    const secHash = state.sections.map(s => `${s.id}:${s.title}:${s.order}`).join(';');
    const hash = _hashPortfolio() + ';;secConfig:' + secHash;
    if (hash === _renderHash.portfolio) return;
    _renderHash.portfolio = hash;

    portfolioContainer.innerHTML = '';

    state.sections.forEach(sec => {
        const secProjects = state.portfolio.filter(p => p.sectionId === sec.id || p.section === sec.title);
        const isCollapsed = collapsedSections.has(sec.id);

        const sectionCard = document.createElement('div');
        sectionCard.className = `section-card ${isCollapsed ? 'collapsed' : ''}`;
        sectionCard.dataset.sectionId = sec.id;
        sectionCard.dataset.section = sec.title;

        sectionCard.innerHTML = `
            <div class="section-card-header" draggable="true" data-section-id="${sec.id}">
                <div class="section-header-left">
                    <span class="section-drag-handle" title="Drag to reorder section card">☰</span>
                    <button type="button" class="btn-toggle-collapse" title="Collapse/Expand">▼</button>
                    <input type="text" class="section-title-input" value="${sec.title}" placeholder="Section Title" title="Click to rename section" data-section-id="${sec.id}">
                    <span class="badge project-count-badge">${secProjects.length} ${secProjects.length === 1 ? 'Project' : 'Projects'}</span>
                </div>
                <div class="section-header-actions">
                    <button type="button" class="btn btn-secondary btn-icon move-section-up" title="Move section up" data-section-id="${sec.id}">↑</button>
                    <button type="button" class="btn btn-secondary btn-icon move-section-down" title="Move section down" data-section-id="${sec.id}">↓</button>
                    <button type="button" class="btn btn-primary add-section-project-btn" data-section-id="${sec.id}" data-section="${sec.title}">+ Add Project</button>
                </div>
            </div>
            <div class="section-card-body">
                <div class="section-projects-list" data-section-id="${sec.id}" data-section="${sec.title}"></div>
            </div>
        `;

        const listContainer = sectionCard.querySelector('.section-projects-list');

        if (secProjects.length === 0) {
            listContainer.innerHTML = `<div class="empty-state">No projects in ${sec.title} yet.</div>`;
        } else {
            secProjects.forEach((proj, idx) => {
                const clone = projectTpl.content.cloneNode(true);
                const card = clone.querySelector('.item-card');
                card.dataset.id = proj.id;
                card.dataset.sectionId = sec.id;
                card.dataset.section = sec.title;
                card.setAttribute('draggable', 'true');

                const imgNode = card.querySelector('.projectPreview');
                if (imgNode) {
                    const newSrc = proj.imageUrl
                        ? getAbsoluteImageUrl(proj.imageUrl)
                        : (proj.image || '');
                    imgNode.src = newSrc;
                }

                const titleNode = card.querySelector('.project-title');
                if (titleNode) titleNode.value = proj.title || '';

                const linkNode = card.querySelector('.project-link');
                if (linkNode) linkNode.value = proj.link || '';

                const descNode = card.querySelector('.project-description');
                if (descNode) descNode.value = proj.description || '';

                const orderNode = card.querySelector('.item-index');
                if (orderNode) orderNode.textContent = idx + 1;

                listContainer.appendChild(card);
            });
        }

        portfolioContainer.appendChild(sectionCard);
    });

    setupDragAndDropEvents();
}

/**
 * Attaches drag & drop event handlers for sections and projects
 */
function setupDragAndDropEvents() {
    // ══ Section Drag & Drop ══
    const sectionHeaders = portfolioContainer.querySelectorAll('.section-card-header');
    sectionHeaders.forEach(header => {
        header.addEventListener('dragstart', (e) => {
            const sectionCard = header.closest('.section-card');
            draggedItemType = 'section';
            draggedSectionId = sectionCard.dataset.sectionId;
            draggedSectionName = sectionCard.dataset.section;
            e.dataTransfer.setData('text/plain', `section:${draggedSectionId}`);
            e.dataTransfer.effectAllowed = 'move';
            sectionCard.classList.add('is-dragging');
        });

        header.addEventListener('dragend', () => {
            const sectionCard = header.closest('.section-card');
            sectionCard.classList.remove('is-dragging');
            draggedItemType = null;
            draggedSectionId = null;
            draggedSectionName = null;
            clearDragStyles();
        });
    });

    const sectionCards = portfolioContainer.querySelectorAll('.section-card');
    sectionCards.forEach(card => {
        card.addEventListener('dragover', (e) => {
            if (draggedItemType !== 'section') return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.classList.add('section-drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('section-drag-over');
        });

        card.addEventListener('drop', (e) => {
            if (draggedItemType !== 'section') return;
            e.preventDefault();
            card.classList.remove('section-drag-over');

            const targetSectionId = card.dataset.sectionId;
            if (!draggedSectionId || draggedSectionId === targetSectionId) return;

            const fromIdx = state.sections.findIndex(s => s.id === draggedSectionId);
            const toIdx = state.sections.findIndex(s => s.id === targetSectionId);

            if (fromIdx !== -1 && toIdx !== -1) {
                const [movedSec] = state.sections.splice(fromIdx, 1);
                state.sections.splice(toIdx, 0, movedSec);

                state.sections.forEach((s, idx) => { s.order = idx + 1; });

                syncPortfolioStateOrders();
                _renderHash.portfolio = '';
                renderPortfolio();
                markDirty();
            }
        });
    });

    // ══ Intra-Section Project Drag & Drop ══
    const projectCards = portfolioContainer.querySelectorAll('.item-card[data-type="project"]');
    projectCards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.stopPropagation(); // Prevents triggering section drag
            draggedItemType = 'project';
            draggedProjectId = card.dataset.id;
            draggedSectionId = card.dataset.sectionId;
            draggedSectionName = card.dataset.section;
            e.dataTransfer.setData('text/plain', `project:${draggedProjectId}:${draggedSectionId}`);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('is-dragging');
        });

        card.addEventListener('dragend', (e) => {
            e.stopPropagation();
            card.classList.remove('is-dragging');
            draggedItemType = null;
            draggedProjectId = null;
            draggedSectionId = null;
            draggedSectionName = null;
            clearDragStyles();
        });

        card.addEventListener('dragover', (e) => {
            if (draggedItemType !== 'project') return;
            // Strictly enforce D&D ONLY inside the same section!
            if (card.dataset.sectionId !== draggedSectionId && card.dataset.section !== draggedSectionName) return;

            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            clearDragStyles();
            const rect = card.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
                card.classList.add('drag-over-top');
            } else {
                card.classList.add('drag-over-bottom');
            }
        });

        card.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            card.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        card.addEventListener('drop', (e) => {
            if (draggedItemType !== 'project') return;
            if (card.dataset.sectionId !== draggedSectionId && card.dataset.section !== draggedSectionName) return;

            e.preventDefault();
            e.stopPropagation();
            clearDragStyles();

            const targetId = card.dataset.id;
            if (draggedProjectId === targetId) return;

            const sectionProjects = state.portfolio.filter(p => p.sectionId === draggedSectionId || p.section === draggedSectionName);
            const fromIdx = sectionProjects.findIndex(p => p.id === draggedProjectId);
            const toIdx = sectionProjects.findIndex(p => p.id === targetId);

            if (fromIdx !== -1 && toIdx !== -1) {
                const rect = card.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                const insertAfter = e.clientY >= mid;

                const [movedProject] = sectionProjects.splice(fromIdx, 1);
                let finalIdx = sectionProjects.findIndex(p => p.id === targetId);
                if (insertAfter) finalIdx += 1;
                sectionProjects.splice(finalIdx, 0, movedProject);

                // Replace section projects in state.portfolio
                const otherProjects = state.portfolio.filter(p => p.sectionId !== draggedSectionId && p.section !== draggedSectionName);
                state.portfolio.length = 0;
                state.portfolio.push(...otherProjects, ...sectionProjects);

                syncPortfolioStateOrders();
                _renderHash.portfolio = '';
                renderPortfolio();
                markDirty();
            }
        });
    });
}

function clearDragStyles() {
    if (!portfolioContainer) return;
    portfolioContainer.querySelectorAll('.drag-over-top, .drag-over-bottom, .section-drag-over, .is-dragging')
        .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom', 'section-drag-over', 'is-dragging'));
}

export function initPortfolio() {
    portfolioContainer = document.getElementById('portfolio-items');
    projectTpl = document.getElementById('tpl-project-item');

    if (!portfolioContainer || !projectTpl) return;

    // Handle Input & Change (title, link, description, section title)
    const handleInputOrChange = e => {
        if (e.target.classList.contains('section-title-input')) {
            const sectionCard = e.target.closest('.section-card');
            if (!sectionCard) return;
            const secId = e.target.dataset.sectionId || sectionCard.dataset.sectionId;
            const secObj = state.sections.find(s => s.id === secId);
            if (!secObj) return;

            const oldSecName = secObj.title;
            const newSecName = e.target.value.trim() || oldSecName;

            if (oldSecName !== newSecName) {
                // 1. Update canonical state.sections
                secObj.title = newSecName;

                // 2. Update projects for backward compatibility
                state.portfolio.forEach(p => {
                    if (p.sectionId === secId || p.section === oldSecName) {
                        p.sectionId = secId;
                        p.section = newSecName;
                    }
                });

                // 3. Update DOM attributes
                sectionCard.dataset.section = newSecName;
                const addBtn = sectionCard.querySelector('.add-section-project-btn');
                if (addBtn) addBtn.dataset.section = newSecName;
                const list = sectionCard.querySelector('.section-projects-list');
                if (list) list.dataset.section = newSecName;

                // 4. Immediately update empty-state text if present
                const emptyStateEl = sectionCard.querySelector('.empty-state');
                if (emptyStateEl) {
                    emptyStateEl.textContent = `No projects in ${newSecName} yet.`;
                }

                markDirty();
            }
            return;
        }

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
        }
        markDirty();
    };

    portfolioContainer.addEventListener('input', handleInputOrChange);
    portfolioContainer.addEventListener('change', handleInputOrChange);

    // Click Event Delegation
    portfolioContainer.addEventListener('click', async (e) => {
        // 1. Collapse / Expand toggle
        const toggleBtn = e.target.closest('.btn-toggle-collapse');
        if (toggleBtn) {
            const sectionCard = toggleBtn.closest('.section-card');
            if (sectionCard) {
                const secId = sectionCard.dataset.sectionId;
                if (collapsedSections.has(secId)) {
                    collapsedSections.delete(secId);
                    sectionCard.classList.remove('collapsed');
                } else {
                    collapsedSections.add(secId);
                    sectionCard.classList.add('collapsed');
                }
            }
            return;
        }

        // 2. Section "+ Add Project"
        const addSecBtn = e.target.closest('.add-section-project-btn');
        if (addSecBtn) {
            const secId = addSecBtn.dataset.sectionId;
            const secObj = state.sections.find(s => s.id === secId) || state.sections[0];
            const resolvedId = secObj ? secObj.id : (secId || 'sec-1');
            const resolvedTitle = secObj ? secObj.title : (addSecBtn.dataset.section || 'Cartoon Roblox Studio');

            collapsedSections.delete(resolvedId); // Uncollapse to show newly created item

            state.portfolio.push({
                id: crypto.randomUUID(),
                order: state.portfolio.length + 1,
                title: '',
                description: '',
                link: '',
                image: '',
                imageId: '',
                imageUrl: '',
                sectionId: resolvedId,
                section: resolvedTitle
            });

            syncPortfolioStateOrders();
            _renderHash.portfolio = '';
            renderPortfolio();
            markDirty();
            return;
        }

        // 3. Move Section Up
        const moveSecUp = e.target.closest('.move-section-up');
        if (moveSecUp) {
            const sectionCard = moveSecUp.closest('.section-card');
            const secId = sectionCard.dataset.sectionId;
            const idx = state.sections.findIndex(s => s.id === secId);
            if (idx > 0) {
                const temp = state.sections[idx];
                state.sections[idx] = state.sections[idx - 1];
                state.sections[idx - 1] = temp;
                state.sections.forEach((s, i) => { s.order = i + 1; });
                syncPortfolioStateOrders();
                _renderHash.portfolio = '';
                renderPortfolio();
                markDirty();
            }
            return;
        }

        // 4. Move Section Down
        const moveSecDown = e.target.closest('.move-section-down');
        if (moveSecDown) {
            const sectionCard = moveSecDown.closest('.section-card');
            const secId = sectionCard.dataset.sectionId;
            const idx = state.sections.findIndex(s => s.id === secId);
            if (idx !== -1 && idx < state.sections.length - 1) {
                const temp = state.sections[idx];
                state.sections[idx] = state.sections[idx + 1];
                state.sections[idx + 1] = temp;
                state.sections.forEach((s, i) => { s.order = i + 1; });
                syncPortfolioStateOrders();
                _renderHash.portfolio = '';
                renderPortfolio();
                markDirty();
            }
            return;
        }

        // 5. Item Level Actions (Delete, Move Up, Move Down inside section)
        const card = e.target.closest('.item-card');
        if (!card || !card.dataset.id) return;
        const cardId = card.dataset.id;
        const secId = card.dataset.sectionId;
        const secName = card.dataset.section;

        const sectionProjects = state.portfolio.filter(p => p.sectionId === secId || p.section === secName);
        const secIndex = sectionProjects.findIndex(p => p.id === cardId);

        if (secIndex === -1) return;

        if (e.target.closest('.delete-item')) {
            const globalIdx = state.portfolio.findIndex(p => p.id === cardId);
            if (globalIdx !== -1) {
                state.portfolio.splice(globalIdx, 1);
                syncPortfolioStateOrders();
                _renderHash.portfolio = '';
                renderPortfolio();
                markDirty();
            }
        } else if (e.target.closest('.move-up') && secIndex > 0) {
            const temp = sectionProjects[secIndex];
            sectionProjects[secIndex] = sectionProjects[secIndex - 1];
            sectionProjects[secIndex - 1] = temp;

            const otherProjects = state.portfolio.filter(p => p.sectionId !== secId && p.section !== secName);
            state.portfolio.length = 0;
            state.portfolio.push(...otherProjects, ...sectionProjects);

            syncPortfolioStateOrders();
            _renderHash.portfolio = '';
            renderPortfolio();
            markDirty();
        } else if (e.target.closest('.move-down') && secIndex < sectionProjects.length - 1) {
            const temp = sectionProjects[secIndex];
            sectionProjects[secIndex] = sectionProjects[secIndex + 1];
            sectionProjects[secIndex + 1] = temp;

            const otherProjects = state.portfolio.filter(p => p.sectionId !== secId && p.section !== secName);
            state.portfolio.length = 0;
            state.portfolio.push(...otherProjects, ...sectionProjects);

            syncPortfolioStateOrders();
            _renderHash.portfolio = '';
            renderPortfolio();
            markDirty();
        }
    });

    // Image Upload Handling (retained 100% existing functionality)
    portfolioContainer.addEventListener('change', e => {
        if (e.target.classList.contains('projectImageUpload')) {
            const card = e.target.closest('.item-card');
            if (!card || !card.dataset.id) return;
            const cardId = card.dataset.id;

            const file = e.target.files[0];
            if (!file) return;

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

                    if (!res.ok) throw new Error("Network error");

                    let data;
                    try {
                        data = await res.json();
                    } catch (e) {
                        throw new Error("Invalid JSON");
                    }

                    if (!data.success || !data.url) {
                        throw new Error(data.error || "Upload failed");
                    }

                    const index = state.portfolio.findIndex(p => p.id === cardId);
                    if (index === -1) {
                        setIsUploading(false);
                        return;
                    }

                    state.portfolio[index] = {
                        ...state.portfolio[index],
                        imageUrl: data.url
                    };
                    delete state.portfolio[index].image;
                    delete state.portfolio[index].imageId;

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
}
