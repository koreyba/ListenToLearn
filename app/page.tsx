"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type PhraseStatus = "pick" | "to_learn" | "learning_now" | "learnt";
type Phrase = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
  source_type: "preset" | "custom";
  status: PhraseStatus;
};

const tabs: Array<{ id: PhraseStatus; label: string; hint: string }> = [
  { id: "pick", label: "Pick to Learn", hint: "Наша подборка фраз для следующего шага." },
  { id: "to_learn", label: "To Learn", hint: "Отложено на будущее." },
  { id: "learning_now", label: "Learning Now", hint: "То, что вы слушаете сейчас." },
  { id: "learnt", label: "Learnt", hint: "Фразы, которые вы уже освоили." },
];

function renderPattern(pattern: string) {
  const parts = pattern.split(/(\[[^\]]+\])/g).filter(Boolean);
  return parts.map((part, index) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <span className="sound-block" key={`${part}-${index}`}>{part.slice(1, -1)}</span>
    ) : <span key={`${part}-${index}`}>{part}</span>
  );
}

export default function Home() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [activeTab, setActiveTab] = useState<PhraseStatus>("pick");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [customText, setCustomText] = useState("");

  const loadPhrases = useCallback(async () => {
    const response = await fetch("/api/phrases", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Не удалось загрузить фразы.");
    setPhrases(data.phrases);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/phrases", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить фразы.");
        if (active) setPhrases(data.phrases);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Не удалось загрузить фразы.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => Object.fromEntries(
    tabs.map((tab) => [tab.id, phrases.filter((phrase) => phrase.status === tab.id).length])
  ) as Record<PhraseStatus, number>, [phrases]);

  const visible = useMemo(
    () => phrases.filter((phrase) => phrase.status === activeTab),
    [activeTab, phrases]
  );

  async function changeStatus(id: string, status: PhraseStatus) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/phrases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось изменить статус.");
      await loadPhrases();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить статус.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePhrase(phrase: Phrase) {
    if (phrase.source_type === "custom" && !window.confirm(`Удалить «${phrase.text}»?`)) return;
    setBusyId(phrase.id);
    setError("");
    try {
      const response = await fetch(`/api/phrases?id=${encodeURIComponent(phrase.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось убрать фразу.");
      await loadPhrases();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось убрать фразу.");
    } finally {
      setBusyId(null);
    }
  }

  async function addCustom(event: FormEvent) {
    event.preventDefault();
    const text = customText.trim();
    if (!text) return;
    setBusyId("new");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось добавить фразу.");
      setCustomText("");
      await loadPhrases();
      setActiveTab((data.status as PhraseStatus) || "to_learn");
      setNotice(data.created === false ? "Эта фраза уже есть в вашей библиотеке." : "Фраза добавлена в To Learn.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось добавить фразу.");
    } finally {
      setBusyId(null);
    }
  }

  function openPhrase(phrase: Phrase) {
    const query = new URLSearchParams({ phrase: phrase.text });
    window.location.assign(`/trainer.html?${query.toString()}`);
  }

  const current = tabs.find((tab) => tab.id === activeTab)!;

  return (
    <main className="library-shell">
      <header className="library-header">
        <div>
          <p className="eyebrow">Connected speech trainer</p>
          <h1>Слушайте живую речь.<br />Выбирайте, что учить.</h1>
        </div>
        <div className="header-total"><strong>{phrases.length}</strong><span>фраз в библиотеке</span></div>
      </header>

      <nav className="tabs" aria-label="Разделы изучения" role="tablist">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "tab active" : "tab"}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            type="button"
          >
            <span>{tab.label}</span><strong>{counts[tab.id] || 0}</strong>
          </button>
        ))}
      </nav>

      <section className="library-section" role="tabpanel">
        <div className="section-heading">
          <div><h2>{current.label}</h2><p>{current.hint}</p></div>
          <form className="add-form" onSubmit={addCustom}>
            <input
              aria-label="Своя фраза"
              maxLength={240}
              onChange={(event) => setCustomText(event.target.value)}
              placeholder="Введите свою фразу"
              value={customText}
            />
            <button disabled={busyId === "new" || !customText.trim()} type="submit">+ В To Learn</button>
          </form>
        </div>

        {error && <div className="notice error" role="alert">{error}</div>}
        {notice && <div className="notice success" role="status">{notice}</div>}
        {loading ? <div className="notice">Загружаю библиотеку…</div> : visible.length === 0 ? (
          <div className="empty-state">
            <strong>Здесь пока пусто</strong>
            <span>{activeTab === "pick" ? "Все фразы уже распределены." : "Переместите сюда первую фразу."}</span>
          </div>
        ) : (
          <div className="phrase-grid">
            {visible.map((phrase) => (
              <article className="phrase-card" key={phrase.id}>
                <button className="phrase-open" onClick={() => openPhrase(phrase)} type="button">
                  <span className="phrase-text">{phrase.text}</span>
                  <span className="phrase-pattern">{renderPattern(phrase.pattern)}</span>
                  <span className="phrase-ipa">{phrase.ipa || "Транскрипция появится позже"}</span>
                  <span className="listen-link">Слушать <span aria-hidden="true">↗</span></span>
                </button>
                <div className="card-actions">
                  {phrase.status === "pick" && <button disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "to_learn")} type="button">Add to Learn</button>}
                  {phrase.status === "to_learn" && <button disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learning_now")} type="button">Start Learning</button>}
                  {phrase.status === "learning_now" && <button disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learnt")} type="button">Mark as Learnt</button>}
                  {phrase.status === "learnt" && <button disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learning_now")} type="button">Learn Again</button>}
                  {phrase.status !== "pick" && <button className="secondary" disabled={busyId === phrase.id} onClick={() => removePhrase(phrase)} type="button">Remove</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
