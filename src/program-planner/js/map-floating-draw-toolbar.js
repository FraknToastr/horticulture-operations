(function () {
  "use strict";

  function initialise() {
    var toolbar = document.getElementById("floatingDrawToolbar");
    var viewport = document.getElementById("eventMap");
    var handle = toolbar && toolbar.querySelector(".program-map-floating-draw-toolbar__handle");
    if (!toolbar || !viewport || !handle || toolbar.dataset.dragReady === "true") return;
    toolbar.dataset.dragReady = "true";

    var drag = null;

    function bounds(left, top) {
      var maxLeft = Math.max(0, viewport.clientWidth - toolbar.offsetWidth);
      var maxTop = Math.max(0, viewport.clientHeight - toolbar.offsetHeight);
      return {
        left: Math.min(Math.max(0, left), maxLeft),
        top: Math.min(Math.max(0, top), maxTop)
      };
    }

    function place(left, top) {
      var next = bounds(left, top);
      toolbar.style.left = (viewport.offsetLeft + next.left) + "px";
      toolbar.style.top = (viewport.offsetTop + next.top) + "px";
      toolbar.style.right = "auto";
      toolbar.style.bottom = "auto";
    }

    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      var viewportRect = viewport.getBoundingClientRect();
      var toolbarRect = toolbar.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - toolbarRect.left,
        offsetY: event.clientY - toolbarRect.top,
        viewportLeft: viewportRect.left,
        viewportTop: viewportRect.top
      };
      handle.setPointerCapture(event.pointerId);
      handle.setAttribute("aria-pressed", "true");
      toolbar.classList.add("is-dragging");
      event.preventDefault();
    });

    handle.addEventListener("pointermove", function (event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      place(event.clientX - drag.viewportLeft - drag.offsetX, event.clientY - drag.viewportTop - drag.offsetY);
    });

    function endDrag(event) {
      if (!drag || (event && drag.pointerId !== event.pointerId)) return;
      if (handle.hasPointerCapture(drag.pointerId)) handle.releasePointerCapture(drag.pointerId);
      drag = null;
      handle.removeAttribute("aria-pressed");
      toolbar.classList.remove("is-dragging");
    }

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    handle.addEventListener("keydown", function (event) {
      var delta = event.shiftKey ? 24 : 8;
      var left = parseFloat(toolbar.style.left) || toolbar.offsetLeft;
      var top = parseFloat(toolbar.style.top) || toolbar.offsetTop;
      if (event.key === "ArrowLeft") left -= delta;
      else if (event.key === "ArrowRight") left += delta;
      else if (event.key === "ArrowUp") top -= delta;
      else if (event.key === "ArrowDown") top += delta;
      else return;
      place(left, top);
      event.preventDefault();
    });

    new ResizeObserver(function () {
      place(toolbar.offsetLeft - viewport.offsetLeft, toolbar.offsetTop - viewport.offsetTop);
    }).observe(viewport);
    place(12, 12);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise);
  else initialise();
})();
