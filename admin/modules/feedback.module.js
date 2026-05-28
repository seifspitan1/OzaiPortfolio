/* ── Feedback Module ──────────────────────────
 * Feedback rendering, star logic, event delegation.
 * ──────────────────────────────────────────── */

import { state, _renderHash, _hashFeedbacks } from './state.js';
import { markDirty } from './storage.js';

let feedbackContainer = null;
let feedbackTpl = null;
let _mouseMoveRAF = 0;

function updateFeedbackStarsUI(container, hoverValue = null, rating = 0) {
    const value = hoverValue !== null ? hoverValue : rating;
    container.querySelectorAll('span').forEach(span => {
        const index = parseInt(span.dataset.index); // this data-index is for the stars structure, not the global element!
        span.classList.remove('full', 'half');
        if (index <= Math.floor(value)) {
            span.classList.add('full');
        } else if (index === Math.ceil(value) && value % 1 !== 0) {
            span.classList.add('half');
        }
    });
}

export function renderFeedbacks() {
    if (!feedbackContainer || !feedbackTpl) return;

    const hash = _hashFeedbacks();
    if (hash === _renderHash.feedbacks) return;
    _renderHash.feedbacks = hash;

    if (state.feedbacks.length === 0) {
        feedbackContainer.innerHTML = `<div class="empty-state">No feedbacks added yet.</div>`;
        return;
    }

    const emptyState = feedbackContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const domNodes = new Map();
    Array.from(feedbackContainer.children).forEach(child => {
        const id = child.dataset.id;
        if (id) {
            if (!state.feedbacks.find(fb => fb.id === id)) {
                child.remove();
            } else {
                domNodes.set(id, child);
            }
        }
    });

    state.feedbacks.forEach((fb, index) => {
        let card = domNodes.get(fb.id);
        
        if (!card) {
            const clone = feedbackTpl.content.cloneNode(true);
            card = clone.querySelector('.item-card');
            card.dataset.id = fb.id;
            feedbackContainer.appendChild(clone);
            card = feedbackContainer.lastElementChild;
            domNodes.set(fb.id, card);
        }

        if (feedbackContainer.children[index] !== card && card) {
            feedbackContainer.insertBefore(card, feedbackContainer.children[index]);
        }

        const nameNode = card.querySelector('.feedback-name');
        if (nameNode && nameNode.value !== fb.clientName) nameNode.value = fb.clientName;

        const textNode = card.querySelector('.feedback-text');
        if (textNode && textNode.value !== fb.text) textNode.value = fb.text;

        const ratingContainer = card.querySelector('.star-rating');
        if (ratingContainer && ratingContainer.dataset.value != fb.rating) {
            ratingContainer.dataset.value = fb.rating;
            updateFeedbackStarsUI(ratingContainer, null, fb.rating);
        }

        const orderNode = card.querySelector('.item-index');
        if (orderNode && orderNode.textContent != fb.order) orderNode.textContent = fb.order;
    });
}

export function initFeedbacks() {
    feedbackContainer = document.getElementById('feedback-items');
    feedbackTpl = document.getElementById('tpl-feedback-item');
    const addFeedbackBtn = document.getElementById('add-feedback-btn');

    if (!addFeedbackBtn || !feedbackContainer || !feedbackTpl) return;

    feedbackContainer.addEventListener('input', e => {
        const card = e.target.closest('.item-card');
        if (!card || !card.dataset.id) return;
        const fb = state.feedbacks.find(f => f.id === card.dataset.id);
        if (!fb) return;

        if (e.target.classList.contains('feedback-name')) {
            fb.clientName = e.target.value;
        } else if (e.target.classList.contains('feedback-text')) {
            fb.text = e.target.value;
        }
        markDirty();
    });

    feedbackContainer.addEventListener('mousemove', e => {
        if (_mouseMoveRAF) return;
        _mouseMoveRAF = requestAnimationFrame(() => {
            _mouseMoveRAF = 0;
            const span = e.target.closest('.star-rating span');
            if (span) {
                const container = span.parentElement;
                const index = parseInt(span.dataset.index); // Star array
                const rect = span.getBoundingClientRect();
                const isHalf = (e.clientX - rect.left) < (rect.width / 2);
                const hoverValue = isHalf ? index - 0.5 : index;
                updateFeedbackStarsUI(container, hoverValue);
            }
        });
    });

    feedbackContainer.addEventListener('mouseout', e => {
        const container = e.target.closest('.star-rating');
        if (container && !container.contains(e.relatedTarget)) {
            const card = container.closest('.item-card');
            if (!card || !card.dataset.id) return;
            const fb = state.feedbacks.find(f => f.id === card.dataset.id);
            if (fb) {
                updateFeedbackStarsUI(container, null, fb.rating);
            }
        }
    });

    feedbackContainer.addEventListener('click', e => {
        const span = e.target.closest('.star-rating span');
        if (span) {
            const card = span.closest('.item-card');
            if (!card || !card.dataset.id) return;
            const fb = state.feedbacks.find(f => f.id === card.dataset.id);
            if (!fb) return;
            
            const spanIndex = parseInt(span.dataset.index);
            const rect = span.getBoundingClientRect();
            const isHalf = (e.clientX - rect.left) < (rect.width / 2);
            
            const newRating = isHalf ? spanIndex - 0.5 : spanIndex;
            if (fb.rating === newRating) return;
            fb.rating = newRating;

            const ratingContainer = span.parentElement;
            if (ratingContainer) {
                ratingContainer.dataset.value = newRating;
                updateFeedbackStarsUI(ratingContainer, null, newRating);
            }
            _renderHash.feedbacks = '';
            markDirty();
            return;
        }

        const card = e.target.closest('.item-card');
        if (!card || !card.dataset.id) return;
        const fbIndex = state.feedbacks.findIndex(f => f.id === card.dataset.id);
        if (fbIndex === -1) return;

        if (e.target.closest('.delete-item')) {
            state.feedbacks.splice(fbIndex, 1);
            state.feedbacks.forEach((p, i) => p.order = i + 1);
            _renderHash.feedbacks = '';
            renderFeedbacks();
            markDirty();
        } else if (e.target.closest('.move-up') && fbIndex > 0) {
            const temp = state.feedbacks[fbIndex];
            state.feedbacks[fbIndex] = state.feedbacks[fbIndex - 1];
            state.feedbacks[fbIndex - 1] = temp;
            state.feedbacks.forEach((p, i) => p.order = i + 1);
            _renderHash.feedbacks = '';
            renderFeedbacks();
            markDirty();
        } else if (e.target.closest('.move-down') && fbIndex < state.feedbacks.length - 1) {
            const temp = state.feedbacks[fbIndex];
            state.feedbacks[fbIndex] = state.feedbacks[fbIndex + 1];
            state.feedbacks[fbIndex + 1] = temp;
            state.feedbacks.forEach((p, i) => p.order = i + 1);
            _renderHash.feedbacks = '';
            renderFeedbacks();
            markDirty();
        }
    });

    addFeedbackBtn.addEventListener('click', () => {
        state.feedbacks.push({
            id: crypto.randomUUID(),
            order: state.feedbacks.length + 1,
            clientName: '',
            text: '',
            rating: 0
        });
        _renderHash.feedbacks = '';
        renderFeedbacks();
        markDirty();
    });
}
