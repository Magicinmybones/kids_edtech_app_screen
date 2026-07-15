(function exposeCourseSwipe(global) {
  const STATE_CLASSES = ['state-top', 'state-pink', 'state-green', 'state-yellow'];

  function mountCourseSwipe(root = document) {
    const featured = root.querySelector('.featured-course');
    if (!featured || featured.dataset.swipeReady === 'true') return;

    const sourceCard = featured.querySelector('.course-card');
    if (!sourceCard) return;

    const sourceImage = sourceCard.querySelector('.course-artwork img');
    const assetRoot = sourceImage.src.replace(/[^/]+(?:\?.*)?$/, '');
    const courses = [
      { file: 'giraffe.png', type: 'giraffe', duration: '5 min', alt: 'A giraffe skateboarder' },
      { file: 'robot-orange.jpg', type: 'flying', duration: '2 min', alt: 'A white flying robot' },
      { file: 'robot.png', type: 'robot', duration: '6 min', alt: 'A white desert robot' },
      { file: 'bee.png', type: 'bee', duration: '4 min', alt: 'A mechanical bee' }
    ];

    const deck = document.createElement('div');
    deck.className = 'course-swipe-deck';
    deck.setAttribute('aria-label', 'Swipeable featured courses');

    const status = document.createElement('p');
    status.className = 'course-swipe-status';
    status.setAttribute('aria-live', 'polite');

    const cards = courses.map((course, index) => {
      const card = sourceCard.cloneNode(true);
      const image = card.querySelector('.course-artwork img');
      image.src = `${assetRoot}${course.file}`;
      image.alt = course.alt;
      image.className = `artwork-${course.type}`;
      card.querySelector('.course-artwork').classList.add(`scene-${course.type}`);
      card.querySelector('.duration').textContent = course.duration;

      const tint = document.createElement('span');
      tint.className = 'course-card-tint';
      tint.setAttribute('aria-hidden', 'true');
      card.append(tint);

      card.classList.add('swipe-card', STATE_CLASSES[index]);
      card.dataset.courseIndex = String(index);
      card.addEventListener('pointerdown', handlePointerDown);
      card.addEventListener('keydown', handleKeyDown);
      deck.append(card);
      return card;
    });

    featured.replaceChildren(deck, status);
    featured.dataset.swipeReady = 'true';
    featured.classList.add('is-swipe-ready');

    let order = [...cards];
    let drag = null;
    let locked = false;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    refreshAccessibility();

    function assignState(card, stateIndex) {
      card.classList.remove(...STATE_CLASSES);
      card.classList.add(STATE_CLASSES[stateIndex]);
    }

    function refreshAccessibility() {
      cards.forEach((card) => {
        const isTop = card === order[0];
        card.tabIndex = isTop ? 0 : -1;
        card.setAttribute('aria-hidden', String(!isTop));
        card.setAttribute('aria-label', isTop
          ? 'Featured course. Drag left or right to dismiss.'
          : '');
        const playButton = card.querySelector('.play-course');
        if (playButton) playButton.tabIndex = isTop ? 0 : -1;
      });
    }

    function handlePointerDown(event) {
      const card = event.currentTarget;
      if (locked || card !== order[0] || event.target.closest('button')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      drag = {
        card,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: 0,
        y: 0,
        velocityX: 0,
        lastX: event.clientX,
        lastTime: performance.now(),
        scaleX: card.getBoundingClientRect().width / card.offsetWidth || 1,
        scaleY: card.getBoundingClientRect().height / card.offsetHeight || 1
      };
      card.classList.add('is-dragging');
      deck.classList.add('is-dragging');
      card.setPointerCapture(event.pointerId);
      deck.addEventListener('pointermove', handlePointerMove);
      deck.addEventListener('pointerup', handlePointerEnd);
      deck.addEventListener('pointercancel', handlePointerCancel);
    }

    function handlePointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();

      const now = performance.now();
      const elapsed = Math.max(1, now - drag.lastTime);
      const instantaneousVelocity = ((event.clientX - drag.lastX) / drag.scaleX) / elapsed;
      drag.velocityX = drag.velocityX * 0.65 + instantaneousVelocity * 0.35;
      drag.lastX = event.clientX;
      drag.lastTime = now;
      drag.x = (event.clientX - drag.startX) / drag.scaleX;
      drag.y = Math.max(-48, Math.min(48, ((event.clientY - drag.startY) / drag.scaleY) * 0.3));

      const rotation = Math.max(-12, Math.min(12, drag.x * 0.035));
      drag.card.style.transform = `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotation}deg)`;
      drag.card.style.setProperty('--swipe-shadow-opacity', String(Math.min(0.24, Math.abs(drag.x) / 650)));
      previewNextCard(Math.abs(drag.x));
    }

    function handlePointerEnd(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const completedDrag = drag;
      clearPointerGesture();

      const projectedX = completedDrag.x + completedDrag.velocityX * 150;
      const shouldThrow = Math.abs(completedDrag.x) >= 76
        || (Math.abs(projectedX) >= 112 && Math.abs(completedDrag.x) >= 18);

      if (shouldThrow) {
        const direction = Math.sign(completedDrag.x || completedDrag.velocityX) || 1;
        throwTopCard(completedDrag.card, direction, completedDrag.x, completedDrag.y);
      } else {
        releaseNextCardPreview(order[1]);
        returnTopCard(completedDrag.card, completedDrag.x, completedDrag.y);
      }
    }

    function handlePointerCancel(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const cancelledDrag = drag;
      clearPointerGesture();
      releaseNextCardPreview(order[1]);
      returnTopCard(cancelledDrag.card, cancelledDrag.x, cancelledDrag.y);
    }

    function previewNextCard(distance) {
      const nextCard = order[1];
      if (!nextCard) return;

      // These are deliberately separate. The tint clears almost immediately,
      // while the same pink card keeps travelling continuously from its exact
      // stacked geometry into the primary geometry. This preserves its visual
      // identity instead of making a new white card appear above it.
      const rawRevealProgress = Math.min(1, distance / 12);
      const revealProgress = 1 - ((1 - rawRevealProgress) ** 3);
      const rawLiftProgress = Math.min(1, distance / 96);
      const liftProgress = 1 - ((1 - rawLiftProgress) ** 2);
      const translateX = -9.51 * (1 - liftProgress);
      const translateY = 27.07 * (1 - liftProgress);
      const rotation = 1.146 * (1 - liftProgress);
      const scaleX = .94152 + ((1 - .94152) * liftProgress);
      const scaleY = .92391 + ((1 - .92391) * liftProgress);

      nextCard.classList.add('is-drag-preview');
      nextCard.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
      const tint = nextCard.querySelector('.course-card-tint');
      if (tint) tint.style.opacity = String(Math.max(0, 1 - revealProgress));
    }

    function releaseNextCardPreview(card) {
      if (!card?.classList.contains('is-drag-preview')) return;
      const tint = card.querySelector('.course-card-tint');
      card.classList.remove('is-drag-preview');
      card.getBoundingClientRect();
      card.style.transform = '';
      if (tint) tint.style.opacity = '';
    }

    function clearPointerGesture() {
      if (!drag) return;
      const { card, pointerId } = drag;
      if (card.hasPointerCapture(pointerId)) card.releasePointerCapture(pointerId);
      card.classList.remove('is-dragging');
      deck.classList.remove('is-dragging');
      deck.removeEventListener('pointermove', handlePointerMove);
      deck.removeEventListener('pointerup', handlePointerEnd);
      deck.removeEventListener('pointercancel', handlePointerCancel);
      drag = null;
    }

    function returnTopCard(card, x, y) {
      locked = true;
      const duration = reducedMotion.matches ? 1 : 320;
      const rotation = Math.max(-12, Math.min(12, x * 0.035));
      const animation = card.animate([
        { transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)` },
        { transform: 'translate3d(0, 0, 0) rotate(0deg)' }
      ], {
        duration,
        easing: 'cubic-bezier(.2, .9, .3, 1)',
        fill: 'forwards'
      });

      animation.finished.finally(() => {
        animation.cancel();
        card.style.transform = '';
        card.style.removeProperty('--swipe-shadow-opacity');
        locked = false;
      });
    }

    function throwTopCard(card, direction, x, y, shouldRestoreFocus = false) {
      if (locked || card !== order[0]) return;
      locked = true;
      deck.classList.add('is-animating');
      card.classList.add('is-leaving');

      const duration = reducedMotion.matches ? 1 : 430;
      const rotation = Math.max(-12, Math.min(12, x * 0.035));
      const destinationX = direction * 540;
      const destinationY = y + Math.min(72, Math.abs(x) * 0.16);
      const animation = card.animate([
        {
          transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`,
          opacity: 1
        },
        {
          transform: `translate3d(${destinationX}px, ${destinationY}px, 0) rotate(${direction * 20}deg)`,
          opacity: 0.18
        }
      ], {
        duration,
        easing: 'cubic-bezier(.2, .72, .18, 1)',
        fill: 'forwards'
      });

      const oldTop = order[0];
      const nextOrder = [order[1], order[2], order[3], oldTop];
      assignState(nextOrder[0], 0);
      assignState(nextOrder[1], 1);
      assignState(nextOrder[2], 2);
      releaseNextCardPreview(nextOrder[0]);
      refreshAccessibilityFor(nextOrder);

      animation.finished.finally(() => {
        oldTop.classList.add('is-recycling');
        animation.cancel();
        oldTop.style.transform = '';
        oldTop.style.removeProperty('--swipe-shadow-opacity');
        assignState(oldTop, 3);
        oldTop.classList.remove('is-leaving');
        order = nextOrder;
        refreshAccessibility();

        // Read once so the browser paints the deeper starting position before
        // transitioning the recycled card into the yellow slot.
        oldTop.getBoundingClientRect();
        requestAnimationFrame(() => {
          oldTop.classList.remove('is-recycling');
          const unlockDelay = reducedMotion.matches ? 1 : 330;
          setTimeout(() => {
            deck.classList.remove('is-animating');
            locked = false;
            if (shouldRestoreFocus) order[0].focus({ preventScroll: true });
          }, unlockDelay);
        });
      });

      const directionName = direction > 0 ? 'right' : 'left';
      status.textContent = `Card dismissed to the ${directionName}. Next course ready.`;
    }

    function refreshAccessibilityFor(nextOrder) {
      cards.forEach((candidate) => {
        const isNextTop = candidate === nextOrder[0];
        candidate.tabIndex = isNextTop ? 0 : -1;
        candidate.setAttribute('aria-hidden', String(!isNextTop));
        const playButton = candidate.querySelector('.play-course');
        if (playButton) playButton.tabIndex = isNextTop ? 0 : -1;
      });
    }

    function handleKeyDown(event) {
      if (locked || event.currentTarget !== order[0]) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      throwTopCard(order[0], direction, 0, 0, true);
    }
  }

  global.mountCourseSwipe = mountCourseSwipe;

  const autoMount = () => mountCourseSwipe(document);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  } else {
    autoMount();
  }
})(window);
