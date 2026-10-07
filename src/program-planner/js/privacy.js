(function (root) {
  "use strict";

  var UOS = root.UOS = root.UOS || {};
  var MASK = "**********";
  var EVENT_NAME = "uos:privacy-changed";
  // Privacy Mode is ALWAYS ON by default; never persisted in browser storage.
  var memoryState = true;

  var APPLICANT_CONTACT_FIELDS = {
    quoteaddress: true,
    email: true,
    emailaddress: true,
    applicantemail: true,
    applicantemailaddress: true,
    customeremail: true,
    customeremailaddress: true,
    contactemail: true,

    phone: true,
    phonenumber: true,
    applicantphone: true,
    applicantphonenumber: true,
    customerphone: true,
    customerphonenumber: true,
    contactphone: true,
    telephone: true,
    mobile: true,
    mobilenumber: true,

    // Customer & Applicant Names
    customername: true,
    applicantname: true,
    contactname: true,
    clientname: true,
    contactperson: true,
    applicant: true
  };

  function normalizeFieldKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function isSensitivePiiField(key, label) {
    if (!key && !label) return false;
    var normKey = normalizeFieldKey(key);
    if (normKey && APPLICANT_CONTACT_FIELDS[normKey]) return true;
    if (label) {
      var normLabel = normalizeFieldKey(label);
      if (normLabel && APPLICANT_CONTACT_FIELDS[normLabel]) return true;
    }
    return false;
  }

  function isEnabled() {
    return memoryState;
  }

  function setEnabled(enabled) {
    var boolVal = Boolean(enabled);
    if (memoryState === boolVal) return boolVal;
    memoryState = boolVal;
    dispatchPrivacyChanged(boolVal);
    return boolVal;
  }

  function toggle() {
    return setEnabled(!isEnabled());
  }

  function resetForWorkspaceActivation() {
    return setEnabled(true);
  }

  function dispatchPrivacyChanged(enabled) {
    var detail = { enabled: Boolean(enabled), mask: MASK };
    var EventConstructor = typeof root.CustomEvent === "function" ? root.CustomEvent : (typeof CustomEvent === "function" ? CustomEvent : null);
    if (EventConstructor) {
      var event = new EventConstructor(EVENT_NAME, { detail: detail, bubbles: true });
      var target = root.document || (typeof document !== "undefined" ? document : null);
      if (target && typeof target.dispatchEvent === "function") try { target.dispatchEvent(event); } catch (_) {}
    }
  }

  function mask(value, keyOrLabelOrForce) {
    if (!isEnabled()) return value;
    if (value === null || typeof value === "undefined" || value === "") return value;

    if (keyOrLabelOrForce === true) {
      return MASK;
    }

    if (typeof keyOrLabelOrForce === "string" && isSensitivePiiField(keyOrLabelOrForce)) {
      return MASK;
    }

    return value;
  }

  function privacyDisplay(value, semanticField) {
    if (value === null || typeof value === "undefined" || value === "") return value;
    return isEnabled() && isSensitivePiiField(semanticField) ? MASK : value;
  }

  function applyToInput(input, value, semanticField, options) {
    if (!input) return value;
    options = options || {};
    var protectedField = isEnabled() && isSensitivePiiField(semanticField);
    if (protectedField) {
      if (root.document && root.document.activeElement === input && typeof input.blur === "function") input.blur();
      input.type = options.maskedType || "text";
      input.value = value === null || typeof value === "undefined" || value === "" ? value || "" : MASK;
      input.readOnly = true;
      if (input.classList) input.classList.add("is-privacy-masked");
      input.title = options.maskedTitle || "Hidden while Privacy Mode is enabled";
      return input.value;
    }
    input.type = options.inputType || options.type || "text";
    input.readOnly = Boolean(options.readOnly);
    if (input.classList) input.classList.remove("is-privacy-masked");
    if (typeof input.removeAttribute === "function") input.removeAttribute("title");
    if (!root.document || root.document.activeElement !== input || options.replaceActive === true) {
      input.value = value === null || typeof value === "undefined" ? "" : value;
    }
    return input.value;
  }

  function projectWithPolicy(target, maskEnabled) {
    if (!target) return target;

    if (Array.isArray(target)) {
      return target.map(function (item) { return projectWithPolicy(item, maskEnabled); });
    }

    if (typeof target === "object") {
      var copy = {};
      var keys = Object.keys(target);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = target[k];
        if (maskEnabled && isSensitivePiiField(k)) {
          copy[k] = (v === null || typeof v === "undefined" || v === "") ? v : MASK;
        } else if (v && typeof v === "object") {
          copy[k] = projectWithPolicy(v, maskEnabled);
        } else {
          copy[k] = v;
        }
      }
      return copy;
    }

    return target;
  }

  function project(target) {
    return projectWithPolicy(target, isEnabled());
  }

  function sanitizeForExport(workspace) {
    return workspaceBackup(workspace);
  }

  function workspaceBackup(workspace) {
    return projectWithPolicy(workspace, false);
  }

  function projectForHumanExport(value) {
    return project(value);
  }

  var ProgramPrivacy = {
    MASK: MASK,
    STORAGE_KEY: null,
    EVENT_NAME: EVENT_NAME,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    toggle: toggle,
    resetForWorkspaceActivation: resetForWorkspaceActivation,
    normalizeFieldKey: normalizeFieldKey,
    isSensitivePiiField: isSensitivePiiField,
    isSensitiveApplicantContactField: isSensitivePiiField,
    isContactField: isSensitivePiiField,
    privacyDisplay: privacyDisplay,
    display: privacyDisplay,
    applyToInput: applyToInput,
    mask: mask,
    project: project,
    projectForPresentation: project,
    workspaceBackup: workspaceBackup,
    cloneForWorkspaceBackup: workspaceBackup,
    projectForHumanExport: projectForHumanExport,
    sanitizeForExport: sanitizeForExport
  };

  UOS.ProgramPrivacy = ProgramPrivacy;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ProgramPrivacy;
  }
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
