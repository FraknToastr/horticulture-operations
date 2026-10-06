// Makes the existing fixed/rotation repeat control explicit without changing allocation policy.
(function () {
  'use strict';
  var modal = window.HortOpsStaffAssignModal;
  if (!modal || typeof modal.renderModal !== 'function') return;
  var originalRender = modal.renderModal;
  modal.renderModal = function () {
    var result = originalRender.apply(this, arguments);
    var root = document.getElementById('staff-assign-modal-root');
    if (!root) return result;
    root.querySelectorAll('.repeat-count-select').forEach(function (select) {
      select.setAttribute('aria-label', 'Number of following occurrences for this staff assignment');
      if (select.previousElementSibling && select.previousElementSibling.hasAttribute('data-continuity-guide')) return;
      var guide = document.createElement('span');
      guide.setAttribute('data-continuity-guide', '');
      guide.className = 'assignment-continuity-guide';
      guide.textContent = 'Apply to next occurrences';
      select.parentNode.insertBefore(guide, select);
    });
    return result;
  };
}());
