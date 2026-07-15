class ScreenPreview extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;

    const template = this.querySelector(':scope > template');
    if (!template) return;

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.append(template.content.cloneNode(true));
    template.remove();

    if (this.dataset.screen === 'start') {
      const button = shadow.querySelector('.cta');
      button?.addEventListener('click', () => {
        button.textContent = 'Let’s go!';
        button.setAttribute('aria-label', 'Getting started');
      });
    }

    if (this.dataset.screen === 'courses') {
      const mountSwipeDeck = () => window.mountCourseSwipe?.(shadow);
      const stylesheet = shadow.querySelector('link[rel="stylesheet"]');
      if (stylesheet?.sheet) mountSwipeDeck();
      else stylesheet?.addEventListener('load', mountSwipeDeck, { once: true });
    }

  }
}

customElements.define('screen-preview', ScreenPreview);

const gallery = document.querySelector('#screen-gallery');
const cards = [...document.querySelectorAll('.screen-card')];

let activeIndex = 0;
let frameRequest = 0;
let dragStartX = 0;
let dragStartScroll = 0;
let isDragging = false;

function fitScreensToViewport() {
  const track = gallery.querySelector('.screen-track');
  const trackStyles = getComputedStyle(track);
  const paddingTop = Number.parseFloat(trackStyles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(trackStyles.paddingBottom) || 0;
  const paddingLeft = Number.parseFloat(trackStyles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(trackStyles.paddingRight) || 0;
  const availableHeight = Math.max(1, gallery.clientHeight - paddingTop - paddingBottom);
  const availableWidth = Math.max(1, gallery.clientWidth - paddingLeft - paddingRight);
  const scale = Math.min(1, availableHeight / 844, availableWidth / 390);

  document.documentElement.style.setProperty('--screen-scale', scale.toFixed(5));
  document.documentElement.style.setProperty('--rendered-screen-width', `${390 * scale}px`);
  document.documentElement.style.setProperty('--rendered-screen-height', `${844 * scale}px`);
}

function nearestCardIndex() {
  const galleryCenter = gallery.scrollLeft + gallery.clientWidth / 2;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(cardCenter - galleryCenter);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function updateActiveIndex() {
  activeIndex = nearestCardIndex();
}

function scrollToCard(index) {
  const boundedIndex = Math.max(0, Math.min(cards.length - 1, index));
  cards[boundedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

gallery.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    scrollToCard(activeIndex - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    scrollToCard(activeIndex + 1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    scrollToCard(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    scrollToCard(cards.length - 1);
  }
});

gallery.addEventListener('scroll', () => {
  cancelAnimationFrame(frameRequest);
  frameRequest = requestAnimationFrame(updateActiveIndex);
}, { passive: true });

gallery.addEventListener('wheel', (event) => {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

  const atStart = gallery.scrollLeft <= 0;
  const atEnd = gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 1;
  if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return;

  event.preventDefault();
  gallery.scrollLeft += event.deltaY;
}, { passive: false });

gallery.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('.screen-card')) return;
  isDragging = true;
  dragStartX = event.clientX;
  dragStartScroll = gallery.scrollLeft;
  gallery.classList.add('is-dragging');
  gallery.setPointerCapture(event.pointerId);
});

gallery.addEventListener('pointermove', (event) => {
  if (!isDragging) return;
  gallery.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
});

function stopDragging(event) {
  if (!isDragging) return;
  isDragging = false;
  gallery.classList.remove('is-dragging');
  if (gallery.hasPointerCapture(event.pointerId)) gallery.releasePointerCapture(event.pointerId);
}

gallery.addEventListener('pointerup', stopDragging);
gallery.addEventListener('pointercancel', stopDragging);

window.addEventListener('resize', () => {
  fitScreensToViewport();
  updateActiveIndex();
}, { passive: true });

fitScreensToViewport();
updateActiveIndex();
