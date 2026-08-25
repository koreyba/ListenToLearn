"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteNavigation } from "@/app/components/site-navigation";
import { SIGN_OUT_HREF } from "@/lib/client-session";

type Integration = {
  provider: "deepl";
  label: string;
  configured: boolean;
  source: "integrations" | null;
};
type IntegrationsResponse = { integrations?: Integration[]; error?: string };

export default function IntegrationsPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/integrations", { cache: "no-store" });
    const data = await response.json() as IntegrationsResponse;
    if (!response.ok) throw new Error(data.error || "Could not check integrations.");
    setIntegration(data.integrations?.[0] || null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadStatus();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not check integrations.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStatus]);

  async function saveKey() {
    if (!key.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "deepl", key: key.trim() }),
      });
      const data = await response.json() as IntegrationsResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the API key.");
      setKey("");
      setIntegration((current) => current
        ? { ...current, configured: true, source: "integrations" }
        : { provider: "deepl", label: "DeepL", configured: true, source: "integrations" });
      setNotice("Key saved. Its value is no longer shown in the app.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the API key.");
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/integrations?provider=deepl", { method: "DELETE" });
      const data = await response.json() as IntegrationsResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete the API key.");
      setIntegration((current) => current
        ? { ...current, configured: false, source: null }
        : current);
      setNotice("The key saved on this page was deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the API key.");
    } finally {
      setBusy(false);
    }
  }

  const sourceText = integration?.source === "integrations"
    ? "The key is encrypted and saved only for this account."
    : "The key is not configured yet.";

  return (
    <>
      <SiteNavigation
        active="settings"
        account={<a className="site-account-link" href={SIGN_OUT_HREF}>Sign out</a>}
      />
      <main className="integrations-shell">
      <p className="eyebrow">Connected speech trainer</p>
      <h1>Integrations</h1>
      <p className="integrations-intro">Connect services that help you learn. Sign in with Google; keys are never returned to the browser after saving.</p>

      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice success" role="status">{notice}</div>}

      <section className="integration-card" aria-labelledby="deepl-title">
        <div className="integration-card-heading">
          <div>
            <p className="integration-label">Translation</p>
            <h2 id="deepl-title">DeepL</h2>
            <p>Translate English phrases into Russian.</p>
          </div>
          <span className={integration?.configured ? "integration-status configured" : "integration-status"}>
            {loading ? "Checking…" : integration?.configured ? "Connected" : "Not connected"}
          </span>
        </div>

        <p className="integration-source">{sourceText}</p>
        <div className="integration-form">
          <label htmlFor="deepl-key">DeepL API key</label>
          <input
            autoComplete="new-password"
            id="deepl-key"
            onChange={(event) => setKey(event.target.value)}
            placeholder={integration?.configured ? "Enter a replacement key" : "Paste your DeepL key"}
            type="password"
            value={key}
          />
          <div className="integration-actions">
            <button disabled={busy || !key.trim()} onClick={() => void saveKey()} type="button">{integration?.configured ? "Replace key" : "Save key"}</button>
            {integration?.configured && <button className="secondary" disabled={busy} onClick={() => void removeKey()} type="button">Delete</button>}
          </div>
        </div>
        <p className="integration-security">The key is sent over HTTPS, encrypted on the Worker with AES-GCM, and stored in D1. It is never included in API responses.</p>
      </section>
      </main>
    </>
  );
}
