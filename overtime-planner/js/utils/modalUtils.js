// Centralized Modal Utilities & Scroll-Lock Manager (Release Candidate Hardening)
// Enforces modal isolation, prevents background scroll leaks, and preserves scroll position.

window.HortOpsModalUtils = (function() {
  var activeModals = 0;
  var savedScrollY = 0;

  function lockBackgroundScroll() {
    if (activeModals === 0) {
      savedScrollY = (typeof window !== 'undefined')
        ? (window.scrollY || window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0)
        : 0;

      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('modal-scroll-locked');
      }
    }
    activeModals++;
  }

  function unlockBackgroundScroll() {
    activeModals = Math.max(0, activeModals - 1);
    if (activeModals === 0) {
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('modal-scroll-locked');
      }
      if (typeof window !== 'undefined') {
        window.scrollTo(0, savedScrollY);
      }
    }
  }

  function getActiveModalCount() {
    return activeModals;
  }

  function getSavedScrollY() {
    return savedScrollY;
  }

  return {
    lockBackgroundScroll: lockBackgroundScroll,
    unlockBackgroundScroll: unlockBackgroundScroll,
    getActiveModalCount: getActiveModalCount,
    getSavedScrollY: getSavedScrollY
  };
})();
