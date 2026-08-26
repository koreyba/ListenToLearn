(function exposeVideoProgressSync(root) {
  "use strict";

  function create(options) {
    const intervalMs = Math.max(1, Number(options && options.intervalMs) || 15_000);
    const now = options && typeof options.now === "function" ? options.now : Date.now;
    const send = options && typeof options.send === "function" ? options.send : async function noop() {};
    const onError = options && typeof options.onError === "function" ? options.onError : function noop() {};
    let pending = null;
    let pendingFingerprint = "";
    let timer = null;
    let lastStartedAt = null;
    let lastDeliveredFingerprint = "";
    let inFlightFingerprint = "";
    let inFlight = Promise.resolve();

    function fingerprint(value) {
      try { return JSON.stringify(value); } catch { return ""; }
    }

    function dispatch(keepalive) {
      if (!pending) return inFlight;
      const snapshot = pending;
      const snapshotFingerprint = pendingFingerprint;
      pending = null;
      pendingFingerprint = "";
      inFlightFingerprint = snapshotFingerprint;
      lastStartedAt = now();
      inFlight = Promise.resolve()
        .then(function sendSnapshot() { return send(snapshot, { keepalive: Boolean(keepalive) }); })
        .then(function rememberDelivery() {
          lastDeliveredFingerprint = snapshotFingerprint;
        })
        .catch(function retainFailedSnapshot(error) {
          if (!pending) {
            pending = snapshot;
            pendingFingerprint = snapshotFingerprint;
          }
          try { onError(error); } catch {}
        })
        .finally(function scheduleTrailing() {
          inFlightFingerprint = "";
          if (pending && !timer) schedule();
        });
      return inFlight;
    }

    function schedule() {
      if (!pending || timer) return;
      const elapsed = lastStartedAt === null ? intervalMs : Math.max(0, now() - lastStartedAt);
      const delay = lastStartedAt === null ? 0 : Math.max(0, intervalMs - elapsed);
      if (delay === 0) {
        dispatch(false);
        return;
      }
      timer = setTimeout(function sendTrailing() {
        timer = null;
        dispatch(false);
      }, delay);
    }

    return {
      update(value) {
        const valueFingerprint = fingerprint(value);
        if (
          valueFingerprint
          && (valueFingerprint === pendingFingerprint
            || valueFingerprint === inFlightFingerprint
            || (!pending && valueFingerprint === lastDeliveredFingerprint))
        ) return;
        pending = value;
        pendingFingerprint = valueFingerprint;
        schedule();
      },
      flush(flushOptions) {
        if (timer) clearTimeout(timer);
        timer = null;
        return inFlight.then(function flushPending() {
          return dispatch(Boolean(flushOptions && flushOptions.keepalive));
        });
      },
      idle() {
        return inFlight;
      },
    };
  }

  root.ListenToLearnVideoProgressSync = { create };
})(globalThis);
