/* ── Portfolio Module ─────────────────────────
 * Grouped Section Cards (Section 1, Section 2, Section 3).
 * Intra-section project reordering & inter-section card reordering.
 * Images stored/uploaded via /api/v1/upload.
 * ──────────────────────────────────────────── */

import { state, _renderHash, _hashPortfolio } from './state.js';
import { markDirty } from './storage.js';
import { setIsUploading, requestSync } from './api.js';
import { getAbsoluteImageUrl, updateSyncStatus } from './ui.module.js';

let portfolioContainer = null;
let projectTpl = null;

const DEFAULT_SECTIONS = ['Section 1', 'Section 2', 'Section 3'];
let sectionOrder = ['Section 1', 'Section 2', 'Section 3'];
const collapsedSections = new Set();

let draggedItemType = null; // 'section' or 'project'
let draggedSectionName = null;
let draggedProjectId = null;

/**
 * Re-indexes state.portfolio based on current sectionOrder and project relative order.
 * Ensures `order` numbers (1..N) reflect section ordering + intra-section project ordering.
 */
export function syncPortfolioStateOrders() {
    // Preserve default sections in order
    const currentSections = new Set();
    state.portfolio.forEach(p => {
        const sec = p.section || 'Section 1';
        currentSections.add(sec);
    });

    // Re-build sectionOrder if necessary while respecting active sectionOrder sequence
    const updatedOrder = sectionOrder.filter(sec => DEFAULT_SECTIONS.includes(sec) || currentSections.has(sec));
    DEFAULT_SECTIONS.forEach(sec => {
        if (!updatedOrder.includes(sec)) {
            updatedOrder.push(sec);
        }
    });
    sectionOrder = updatedOrder;

    // Group projects by section
    const grouped = {};
    sectionOrder.forEach(sec => { grouped[sec] = []; });

    state.portfolio.forEach(p => {
        const sec = p.section || 'Section 1';
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push(p);
    });

    // Reconstruct flattened state.portfolio with updated order property
    const newPortfolio = [];
    let currentOrder = 1;

    sectionOrder.forEach(sec => {
        const projects = grouped[sec] || [];
        projects.forEach(p => {
            p.section = sec;
            p.order = currentOrder++;
            newPortfolio.push(p);
        });
    });

    state.portfolio.length = 0;
    state.portfolio.push(...newPortfolio);
}

/**
 * Initializes sectionOrder from existing state.portfolio order of appearance
 */
function initSectionOrderFromState() {
    const foundSections = [];
    state.portfolio.forEach(p => {
        const sec = p.section || 'Section 1';
        if (!foundSections.includes(sec)) {
            foundSections.push(sec);
        }
    });

    DEFAULT_SECTIONS.forEach(sec => {
        if (!foundSections.includes(sec)) {
            foundSections.push(sec);
        }
    });

    sectionOrder = foundSections;
}

export async function renderPortfolio() {
    if (!portfolioContainer || !projectTpl) return;

    // Ensure state orders and sectionOrder are synchronized
    if (state.portfolio.length > 0) {
        initSectionOrderFromState();
    }
    syncPortfolioStateOrders();

    const hash = _hashPortfolio() + ';;secOrder:' + sectionOrder.join(',');
    if (hash === _renderHash.portfolio) return;
    _renderHash.portfolio = hash;

    portfolioContainer.innerHTML = '';

    sectionOrder.forEach(secName => {
        const secProjects = state.portfolio.filter(p => (p.section || 'Section 1') === secName);
        const isCollapsed = collapsedSections.has(secName);

        const sectionCard = document.createElement('div');
        sectionCard.className = `section-card ${isCollapsed ? 'collapsed' : ''}`;
        sectionCard.dataset.section = secName;

        sectionCard.innerHTML = `
            <div class="section-card-header" draggable="true">
                <div class="section-header-left">
                    <span class="section-drag-handle" title="Drag to reorder section card">☰</span>
                    <button type="button" class="btn-toggle-collapse" title="Collapse/Expand">▼</button>
                    <h3 class="section-title">${secName}</h3>
                    <span class="badge project-count-badge">${secProjects.length} ${secProjects.length === 1 ? 'Project' : 'Projects'}</span>
                </div>
                <div class="section-header-actions">
                    <button type="button" class="btn btn-secondary btn-icon move-section-up" title="Move section up">↑</button>
                    <button type="button" class="btn btn-secondary btn-icon move-section-down" title="Move section down">↓</button>
                    <button type="button" class="btn btn-primary add-section-project-btn" data-section="${secName}">+ Add Project</button>
                </div>
            </div>
            <div class="section-card-body">
                <div class="section-projects-list" data-section="${secName}"></div>
            </div>
        `;

        const listContainer = sectionCard.querySelector('.section-projects-list');

        if (secProjects.length === 0) {
            listContainer.innerHTML = `<div class="empty-state">No projects in ${secName} yet.</div>`;
        } else {
            secProjects.forEach((proj, idx) => {
                const clone = projectTpl.content.cloneNode(true);
                const card = clone.querySelector('.item-card');
                card.dataset.id = proj.id;
                card.dataset.section = secName;
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
            draggedSectionName = sectionCard.dataset.section;
            e.dataTransfer.setData('text/plain', `section:${draggedSectionName}`);
            e.dataTransfer.effectAllowed = 'move';
            sectionCard.classList.add('is-dragging');
        });

        header.addEventListener('dragend', () => {
            const sectionCard = header.closest('.section-card');
            sectionCard.classList.remove('is-dragging');
            draggedItemType = null;
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

            const targetSection = card.dataset.section;
            if (!draggedSectionName || draggedSectionName === targetSection) return;

            const fromIdx = sectionOrder.indexOf(draggedSectionName);
            const toIdx = sectionOrder.indexOf(targetSection);

            if (fromIdx !== -1 && toIdx !== -1) {
                sectionOrder.splice(fromIdx, 1);
                sectionOrder.splice(toIdx, 0, draggedSectionName);

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
            draggedSectionName = card.dataset.section;
            e.dataTransfer.setData('text/plain', `project:${draggedProjectId}:${draggedSectionName}`);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('is-dragging');
        });

        card.addEventListener('dragend', (e) => {
            e.stopPropagation();
            card.classList.remove('is-dragging');
            draggedItemType = null;
            draggedProjectId = null;
            draggedSectionName = null;
            clearDragStyles();
        });

        card.addEventListener('dragover', (e) => {
            if (draggedItemType !== 'project') return;
            // Strictly enforce D&D ONLY inside the same section!
            if (card.dataset.section !== draggedSectionName) return;

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
            if (card.dataset.section !== draggedSectionName) return; // Disallow cross-section drop

            e.preventDefault();
            e.stopPropagation();
            clearDragStyles();

            const targetId = card.dataset.id;
            if (draggedProjectId === targetId) return;

            const sectionProjects = state.portfolio.filter(p => (p.section || 'Section 1') === draggedSectionName);
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
                const otherProjects = state.portfolio.filter(p => (p.section || 'Section 1') !== draggedSectionName);
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

    // Handle Input & Change (title, link, description)
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
                const secName = sectionCard.dataset.section;
                if (collapsedSections.has(secName)) {
                    collapsedSections.delete(secName);
                    sectionCard.classList.remove('collapsed');
                } else {
                    collapsedSections.add(secName);
                    sectionCard.classList.add('collapsed');
                }
            }
            return;
        }

        // 2. Section "+ Add Project"
        const addSecBtn = e.target.closest('.add-section-project-btn');
        if (addSecBtn) {
            const secName = addSecBtn.dataset.section || 'Section 1';
            collapsedSections.delete(secName); // Uncollapse to show newly created item

            state.portfolio.push({
                id: crypto.randomUUID(),
                order: state.portfolio.length + 1,
                title: '',
                description: '',
                link: '',
                image: '',
                imageId: '',
                imageUrl: '',
                section: secName
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
            const secName = sectionCard.dataset.section;
            const idx = sectionOrder.indexOf(secName);
            if (idx > 0) {
                const temp = sectionOrder[idx];
                sectionOrder[idx] = sectionOrder[idx - 1];
                sectionOrder[idx - 1] = temp;
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
            const secName = sectionCard.dataset.section;
            const idx = sectionOrder.indexOf(secName);
            if (idx < sectionOrder.length - 1) {
                const temp = sectionOrder[idx];
                sectionOrder[idx] = sectionOrder[idx + 1];
                sectionOrder[idx + 1] = temp;
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
        const secName = card.dataset.section || 'Section 1';

        const sectionProjects = state.portfolio.filter(p => (p.section || 'Section 1') === secName);
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

            const otherProjects = state.portfolio.filter(p => (p.section || 'Section 1') !== secName);
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

            const otherProjects = state.portfolio.filter(p => (p.section || 'Section 1') !== secName);
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
