"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Integration = {
  provider: "deepl";
  label: string;
  configured: boolean;
  source: "integrations" | "worker_secret" | null;
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
    if (!response.ok) throw new Error(data.error || "Не удалось проверить интеграции.");
    setIntegration(data.integrations?.[0] || null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadStatus();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Не удалось проверить интеграции.");
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
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить API-ключ.");
      setKey("");
      await loadStatus();
      setNotice("Ключ сохранён. Его значение больше не показывается в приложении.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить API-ключ.");
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
      if (!response.ok) throw new Error(data.error || "Не удалось удалить API-ключ.");
      await loadStatus();
      setNotice("Ключ, сохранённый на этой странице, удалён.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить API-ключ.");
    } finally {
      setBusy(false);
    }
  }

  const sourceText = integration?.source === "worker_secret"
    ? "Ключ настроен в Cloudflare Worker Secret."
    : integration?.source === "integrations"
      ? "Ключ сохранён в зашифрованном виде."
      : "Ключ пока не настроен.";

  return (
    <main className="integrations-shell">
      <Link className="back-link" href="/">← Назад к библиотеке</Link>
      <p className="eyebrow">Connected speech trainer</p>
      <h1>Integrations</h1>
      <p className="integrations-intro">Подключайте сервисы, которые помогают учиться. Страница закрыта Cloudflare Access, а ключи не возвращаются в браузер после сохранения.</p>

      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice success" role="status">{notice}</div>}

      <section className="integration-card" aria-labelledby="deepl-title">
        <div className="integration-card-heading">
          <div>
            <p className="integration-label">Перевод</p>
            <h2 id="deepl-title">DeepL</h2>
            <p>Перевод английских фраз на русский.</p>
          </div>
          <span className={integration?.configured ? "integration-status configured" : "integration-status"}>
            {loading ? "Проверяю…" : integration?.configured ? "Подключено" : "Не подключено"}
          </span>
        </div>

        <p className="integration-source">{sourceText}</p>
        {integration?.source !== "worker_secret" && (
          <div className="integration-form">
            <label htmlFor="deepl-key">DeepL API key</label>
            <input
              autoComplete="new-password"
              id="deepl-key"
              onChange={(event) => setKey(event.target.value)}
              placeholder={integration?.configured ? "Введите новый ключ для замены" : "Вставьте ключ DeepL"}
              type="password"
              value={key}
            />
            <div className="integration-actions">
              <button disabled={busy || !key.trim()} onClick={() => void saveKey()} type="button">{integration?.configured ? "Заменить ключ" : "Сохранить ключ"}</button>
              {integration?.configured && <button className="secondary" disabled={busy} onClick={() => void removeKey()} type="button">Удалить</button>}
            </div>
          </div>
        )}
        <p className="integration-security">Ключ передаётся по HTTPS, шифруется на Worker через AES-GCM и хранится в D1. В ответах API его нет.</p>
      </section>
    </main>
  );
}
