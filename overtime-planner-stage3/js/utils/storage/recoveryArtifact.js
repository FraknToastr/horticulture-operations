'use strict';

/**
 * recoveryArtifact.js
 *
 * Pure module defining the versioned, immutable emergency recovery artifact
 * contract and validation rules for Stage 2 (Review 39 R39-01, R39-02).
 */

var HortOpsRecoveryArtifact = (function() {
  var ARTIFACT_TYPE = 'hort_ops_reset_recovery';
  var ARTIFACT_VERSION = 1;
  var RECOVERY_KEY_PREFIX = 'hort_ops_emergency_recovery_v2:';

  function isApplicationOwnedKey(key) {
    if (typeof key !== 'string') return false;
    return key.indexOf('hort_ops_') === 0 || key.indexOf('__hort_ops_') === 0;
  }

  function generateRecoveryId() {
    return 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  function createEmergencyRecoveryArtifact(storageSnapshot, options) {
    options = options || {};
    var recoveryId = options.recoveryId || generateRecoveryId();
    var rawSnapshot = storageSnapshot || {};
    var cleanSnapshot = {};

    for (var k in rawSnapshot) {
      if (Object.prototype.hasOwnProperty.call(rawSnapshot, k)) {
        if (isApplicationOwnedKey(k)) {
          cleanSnapshot[k] = rawSnapshot[k];
        }
      }
    }

    var unrecKeys = [];
    if (Array.isArray(options.unrecoveredKeys)) {
      unrecKeys = options.unrecoveredKeys.slice();
    }

    return {
      artifactType: ARTIFACT_TYPE,
      artifactVersion: ARTIFACT_VERSION,
      recoveryId: recoveryId,
      createdAt: new Date().toISOString(),
      reason: options.reason || 'incomplete_reset_rollback',
      failedKey: options.failedKey || null,
      error: options.error || null,
      unrecoveredKeys: unrecKeys,
      storageSnapshot: cleanSnapshot
    };
  }

  function validateEmergencyRecoveryArtifact(input) {
    if (input === null || input === undefined) {
      return { valid: false, error: 'Artifact input cannot be null or undefined' };
    }

    var artifact = input;
    if (typeof input === 'string') {
      try {
        artifact = JSON.parse(input);
      } catch (err) {
        return { valid: false, error: 'Artifact JSON parse failed: ' + (err.message || String(err)) };
      }
    }

    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      return { valid: false, error: 'Artifact must be a JSON object' };
    }

    if (artifact.artifactType !== ARTIFACT_TYPE) {
      return { valid: false, error: 'Unsupported or invalid artifactType: ' + artifact.artifactType };
    }

    if (artifact.artifactVersion !== ARTIFACT_VERSION) {
      return { valid: false, error: 'Unsupported artifactVersion: ' + artifact.artifactVersion };
    }

    if (!artifact.storageSnapshot || typeof artifact.storageSnapshot !== 'object' || Array.isArray(artifact.storageSnapshot)) {
      return { valid: false, error: 'Artifact storageSnapshot must be an object dictionary' };
    }

    if (!artifact.recoveryId || typeof artifact.recoveryId !== 'string' || !artifact.recoveryId.trim()) {
      return { valid: false, error: 'Artifact must have a non-empty recoveryId' };
    }

    if (artifact.createdAt && (typeof artifact.createdAt !== 'string' || isNaN(Date.parse(artifact.createdAt)))) {
      return { valid: false, error: 'Artifact has invalid createdAt timestamp' };
    }

    // Strict security & isolation check: all keys must be application-owned and values must be raw strings
    for (var key in artifact.storageSnapshot) {
      if (Object.prototype.hasOwnProperty.call(artifact.storageSnapshot, key)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return { valid: false, error: 'Disallowed property key: ' + key };
        }
        if (!isApplicationOwnedKey(key)) {
          return { valid: false, error: 'Unauthorized key in storage snapshot: ' + key };
        }
        var val = artifact.storageSnapshot[key];
        if (typeof val !== 'string') {
          return { valid: false, error: 'Storage snapshot value for ' + key + ' must be a raw string' };
        }
      }
    }

    return {
      valid: true,
      artifact: artifact
    };
  }

  function getRecoveryKey(recoveryId) {
    return RECOVERY_KEY_PREFIX + recoveryId;
  }

  return {
    ARTIFACT_TYPE: ARTIFACT_TYPE,
    ARTIFACT_VERSION: ARTIFACT_VERSION,
    RECOVERY_KEY_PREFIX: RECOVERY_KEY_PREFIX,
    isApplicationOwnedKey: isApplicationOwnedKey,
    createEmergencyRecoveryArtifact: createEmergencyRecoveryArtifact,
    validateEmergencyRecoveryArtifact: validateEmergencyRecoveryArtifact,
    getRecoveryKey: getRecoveryKey
  };
})();

if (typeof window !== 'undefined') {
  window.HortOpsRecoveryArtifact = HortOpsRecoveryArtifact;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HortOpsRecoveryArtifact;
}
