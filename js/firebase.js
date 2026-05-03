// ============================================================
//  SSI Inventory — Firebase Firestore Integration (v4 FIXED)
//  firebase.js
//  Firebase SDK compat scripts MUST be loaded in index.html
//  BEFORE this file.
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

  // ── Init Firebase once ──────────────────────────────────────
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const db      = firebase.firestore();
  const DOC_REF = db.collection('ssi').doc('data');

  let _unsubscribe  = null;
  let _isSaving     = false;
  let _pendingSave  = null;   // FIX: queue the latest save instead of dropping it
  let _saveTimer    = null;

  // ── Force long polling (helps behind firewalls/proxies/Render) ──
  try {
    db.settings({ experimentalForceLongPolling: true, merge: true });
  } catch(e) { /* already set */ }

  // ── Sync badge helper ───────────────────────────────────────
  function showSyncBadge(ok) {
    const b = document.getElementById('sync-badge');
    if (!b) return;
    b.textContent      = ok ? '✅ Synced' : '🔴 Offline';
    b.style.background = ok ? '#22c55e'  : '#ef4444';
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 2500);
  }

  // ── Load (Firestore first → localStorage fallback) ──────────
  async function loadFromFirestore() {
    try {
      const snap = await Promise.race([
        DOC_REF.get({ source: 'server' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
      ]);
      if (snap && snap.exists) {
        console.log('[SSI Firebase] ✅ Loaded from Firestore');
        showSyncBadge(true);
        return snap.data();
      }
      console.warn('[SSI Firebase] No document yet — will seed defaults');
      return null;
    } catch (err) {
      console.error('[SSI Firebase] Firestore load failed:', err.message);
      showSyncBadge(false);
    }

    // Fallback → localStorage
    try {
      const raw = localStorage.getItem('ssiData');
      if (raw) {
        console.log('[SSI Firebase] Loaded from localStorage (offline fallback)');
        return JSON.parse(raw);
      }
    } catch (e) {}
    return null;
  }

  // ── Save ────────────────────────────────────────────────────
  // FIX: Instead of silently dropping saves when _isSaving=true,
  //      we queue the latest save and run it once current save finishes.
  async function saveToFirestore(stateObj) {
    // Always write localStorage immediately (instant, offline-safe)
    try { localStorage.setItem('ssiData', JSON.stringify(stateObj)); } catch (e) {}

    if (_isSaving) {
      // Queue this save — it will run after current save finishes
      _pendingSave = stateObj;
      return;
    }

    _isSaving = true;
    try {
      await DOC_REF.set(stateObj);
      showSyncBadge(true);
      console.log('[SSI Firebase] ✅ Saved to Firestore');
    } catch (err) {
      console.warn('[SSI Firebase] Firestore save failed:', err.message);
      showSyncBadge(false);
    } finally {
      // FIX: Extend guard to 5s so syncListener doesn't overwrite fresh data
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(() => {
        _isSaving = false;
        // Run any queued save
        if (_pendingSave) {
          const next = _pendingSave;
          _pendingSave = null;
          saveToFirestore(next);
        }
      }, 8000);  // 8s guard — enough for slow connections
    }
  }

  // ── Real-time listener ──────────────────────────────────────
  function syncListener() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }

    _unsubscribe = DOC_REF.onSnapshot(
      { includeMetadataChanges: false },
      snap => {
        // FIX: skip if we just saved (prevents overwriting our own fresh changes)
        if (!snap || !snap.exists || _isSaving) return;

        const incoming    = snap.data();
        const currentUser = SSIApp.state.currentUser;

        // Only apply if Firestore data is NEWER than what we have locally
        // (prevents stale cached snapshots from overwriting fresh data)
        const incomingTs = incoming.lastSaved || '';
        const currentTs  = SSIApp.state.lastSaved || '';
        if (incomingTs && currentTs && incomingTs < currentTs) {
          console.warn('[SSI Firebase] Skipping stale snapshot (incoming:', incomingTs, '< current:', currentTs, ')');
          return;
        }

        Object.assign(SSIApp.state, incoming);
        SSIApp.state.currentUser = currentUser;

        try { localStorage.setItem('ssiData', JSON.stringify(SSIApp.state)); } catch (e) {}

        showSyncBadge(true);
        const page = document.body.getAttribute('data-page');
        if (page && page !== 'login') SSIApp.navigate(page);
        console.log('[SSI Firebase] 🔄 Real-time update received');
      },
      err => {
        console.error('[SSI Firebase] Listener error:', err.message);
        showSyncBadge(false);
      }
    );

    console.log('[SSI Firebase] 👂 Real-time listener started');
  }

  // ── Expose globally ─────────────────────────────────────────
  window.SSIFirebase = { db, loadFromFirestore, saveToFirestore, syncListener };

})();
