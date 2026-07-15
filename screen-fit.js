(function fitStandaloneScreenToViewport() {
  const SCREEN_WIDTH = 390;
  const SCREEN_HEIGHT = 844;
  const root = document.documentElement;
  let frame = 0;

  function updateScale() {
    frame = 0;
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth || root.clientWidth;
    const height = viewport?.height || window.innerHeight || root.clientHeight;
    const scale = Math.min(1, width / SCREEN_WIDTH, height / SCREEN_HEIGHT);

    root.style.setProperty('--viewport-scale', Math.max(0.01, scale).toFixed(6));
  }

  function requestScaleUpdate() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateScale);
  }

  updateScale();
  window.addEventListener('resize', requestScaleUpdate, { passive: true });
  window.addEventListener('orientationchange', requestScaleUpdate, { passive: true });
  window.visualViewport?.addEventListener('resize', requestScaleUpdate, { passive: true });
})();
