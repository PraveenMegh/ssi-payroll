// ============================================================
//  SSI Inventory — Firebase Firestore Integration (v5 SAFE)
//  firebase.js
//  Stage 1 — Safety Nets:
//    1. Persistent save indicator (no auto-hide)
//    2. Stale-write protection (fetch-merge before save)
//    3. Failed-save logging to sync_errors collection
//    4. Heartbeat connectivity check every 60s
//    5. currentUser is NEVER persisted to Firestore
// ============================================================

(function () {
  'use strict';

  const firebaseConfig = {
    apiKey:            "AIzaSyDVKuFoudpThq6jSN94WDnN99ayLuuxLAQ",
    authDomain:        "ssi-inventory.firebaseapp.com",
    projectId:         "ssi-inventory",
    storageBucket:     "ssi-inventory.firebasestorage.app",
    messagingSenderId: "90864108725",
    appId:             "1:90864108725:web:625c8234c0a38fadecaafc"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const db      = firebase.firestore();
  const DOC_REF = db.collection('ssi').doc('data');
  const ERR_REF = db.collection('sync_errors');

  let _unsubscribe   = null;
  let _isSaving      = false;
  let _pendingSave   = null;
  let _lastServerTs  = null;   // server-side lastSaved we last observed
  let _heartbeatId   = null;

  try {
    db.settings({ experimentalForceLongPolling: true, merge: true });
  } catch (e) { /* already set */ }

  // ── Persistent badge ─────────────────────────────────────────
  // States: 'saved' | 'saving' | 'failed' | 'offline'
  function setBadge(state, msg) {
    const b = document.getElementById('sync-badge');
    if (!b) return;
    const map = {
      saved:   { text: '✓ Saved',     bg: '#22c55e' },
      saving:  { text: '⏳ Saving…',   bg: '#f59e0b' },
      failed:  { text: '✗ Save Failed', bg: '#ef4444' },
      offline: { text: '🔴 Offline',   bg: '#ef4444' }
    };
    const cfg = map[state] || map.saved;
    b.textContent      = msg ? cfg.text + ' — ' + msg : cfg.text;
    b.style.background = cfg.bg;
    b.classList.add('show');
    // NOTE: removed the auto-hide setTimeout — badge is now persistent.
  }

  // ── Failed-save logger ───────────────────────────────────────
  async function logSyncError(kind, err, extra) {
    try {
      await ERR_REF.add({
        kind: kind || 'unknown',
        message: (err && err.message) || String(err || ''),
        extra: extra || null,
        ua: navigator.userAgent,
        ts: firebase.firestore.FieldValue.serverTimestamp(),
        user: (window.SSIApp && SSIApp.state && SSIApp.state.currentUser && SSIApp.state.currentUser.username) || 'unknown'
      });
    } catch (e) { /* swallow — don't recurse */ }
  }

  // ── Strip volatile fields before write ───────────────────────
  function sanitizeForWrite(stateObj) {
    const { currentUser, ...rest } = stateObj || {};
    return rest;
  }

  // ── Load (Firestore first → localStorage fallback) ───────────
  async function loadFromFirestore() {
    try {
      const snap = await Promise.race([
        DOC_REF.get({ source: 'server' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
      ]);
      if (snap && snap.exists) {
        const data = snap.data();
        _lastServerTs = data.lastSaved || null;
        setBadge('saved');
        return data;
      }
      return null;
    } catch (err) {
      console.error('[SSI] load failed:', err.message);
      setBadge('offline', err.message);
      logSyncError('load', err);
    }
    try {
      const raw = localStorage.getItem('ssiData');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  // ── Stale-write protection: fetch latest, refuse if newer ─────
  async function isLocalNewer(stateObj) {
    try {
      const snap = await DOC_REF.get({ source: 'server' });
      if (!snap.exists) return true;
      const remoteTs = snap.data().lastSaved || '';
      const localTs  = (stateObj && stateObj.lastSaved) || '';
      if (!remoteTs) return true;
      if (!localTs)  return false;
      return localTs >= remoteTs;
    } catch (e) {
      // On error, do NOT save (fail safe)
      logSyncError('stale-check', e);
      return false;
    }
  }

  // ── Save (with stale protection + queue) ─────────────────────
  async function saveToFirestore(stateObj) {
    // localStorage write is instant and safe
    try { localStorage.setItem('ssiData', JSON.stringify(stateObj)); } catch (e) {}

    if (_isSaving) {
      _pendingSave = stateObj;
      return;
    }

    _isSaving = true;
    setBadge('saving');

    try {
      const safeToSave = await isLocalNewer(stateObj);
      if (!safeToSave) {
        // Refuse to overwrite newer remote data
        setBadge('failed', 'Server has newer data — please refresh');
        await logSyncError('refused-stale', new Error('local older than server'), {
          localTs: stateObj && stateObj.lastSaved,
        });
        return;
      }

      const payload = sanitizeForWrite(stateObj);
      await DOC_REF.set(payload);
      _lastServerTs = payload.lastSaved || null;
      setBadge('saved');
      console.log('[SSI] ✓ Saved');
    } catch (err) {
      console.warn('[SSI] save failed:', err.message);
      setBadge('failed', err.message);
      await logSyncError('save', err);
    } finally {
      _isSaving = false;
      if (_pendingSave) {
        const next = _pendingSave;
        _pendingSave = null;
        // small delay to avoid hammering
        setTimeout(() => saveToFirestore(next), 500);
      }
    }
  }

  // ── Real-time listener ───────────────────────────────────────
  function syncListener() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }

    _unsubscribe = DOC_REF.onSnapshot(
      { includeMetadataChanges: false },
      snap => {
        if (!snap || !snap.exists || _isSaving) return;
        const incoming   = snap.data();
        const incomingTs = incoming.lastSaved || '';
        const currentTs  = (SSIApp.state && SSIApp.state.lastSaved) || '';

        // Only apply if incoming is newer
        if (incomingTs && currentTs && incomingTs <= currentTs) return;

        const keepUser = SSIApp.state.currentUser;
        Object.assign(SSIApp.state, incoming);
        SSIApp.state.currentUser = keepUser;   // never let remote overwrite my session

        try { localStorage.setItem('ssiData', JSON.stringify(SSIApp.state)); } catch (e) {}

        _lastServerTs = incomingTs || _lastServerTs;
        setBadge('saved');

        const page = document.body.getAttribute('data-page');
        if (page && page !== 'login') SSIApp.navigate(page);
      },
      err => {
        console.error('[SSI] listener error:', err.message);
        setBadge('offline', err.message);
        logSyncError('listener', err);
      }
    );
  }

  // ── Heartbeat (connectivity check every 60s) ─────────────────
  function startHeartbeat() {
    if (_heartbeatId) clearInterval(_heartbeatId);
    _heartbeatId = setInterval(async () => {
      try {
        await DOC_REF.get({ source: 'server' });
        // If we were offline, restore badge
        const b = document.getElementById('sync-badge');
        if (b && b.textContent.indexOf('Offline') !== -1) setBadge('saved');
      } catch (err) {
        setBadge('offline', err.message);
      }
    }, 60000);
  }

  // ── Manual one-click backup helper ───────────────────────────
  async function backupNow() {
    try {
      const snap = await DOC_REF.get({ source: 'server' });
      if (!snap.exists) throw new Error('No data found');
      const data = snap.data();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0,10);
      a.href     = url;
      a.download = `ssi-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      alert('Backup failed: ' + err.message);
      logSyncError('backup', err);
      return false;
    }
  }

  // ── Expose globally ──────────────────────────────────────────
  window.SSIFirebase = {
    db, loadFromFirestore, saveToFirestore, syncListener,
    backupNow, setBadge
  };

  // Start heartbeat on load
  if (document.readyState !== 'loading') startHeartbeat();
  else document.addEventListener('DOMContentLoaded', startHeartbeat);
})();
