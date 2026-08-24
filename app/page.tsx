"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRESET_PHRASES } from "@/lib/preset-phrases";
import {
  GUEST_LIBRARY_STORAGE_KEY,
  addGuestPhrase,
  createGuestLibrary,
  normalizeGuestLibrary,
  removeGuestPhrase,
  setGuestPhraseStatus,
  type GuestLibraryState,
} from "@/lib/guest-library";

type PhraseStatus = "pick" | "to_learn" | "learning_now" | "learnt";
type Phrase = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
  translation: string;
  context: string;
  source_type: "preset" | "custom";
  catalog_order: number | null;
  status: PhraseStatus;
  created_at: string;
  updated_at: string;
};
type PhrasesResponse = { phrases: Phrase[]; user?: Viewer; error?: string };
type PhraseMutationResponse = {
  id?: string;
  status?: PhraseStatus;
  translation?: string;
  context?: string;
  created_at?: string;
  updated_at?: string;
  error?: string;
  created?: boolean;
  translationPending?: boolean;
};
type Viewer = { id: string; email: string; name: string };

const tabs: Array<{ id: PhraseStatus; label: string; hint: string }> = [
  { id: "pick", label: "Pick", hint: "Our phrase picks for the next step." },
  { id: "to_learn", label: "To Learn", hint: "Saved for later." },
  { id: "learning_now", label: "Learning Now", hint: "What you are listening to now." },
  { id: "learnt", label: "Learnt", hint: "Phrases you have already mastered." },
];

type PhraseSort = "added_desc" | "added_asc" | "alpha_asc" | "alpha_desc";

const PHRASE_SORT_STORAGE_KEY = "listen-to-learn-library-sort-v1";
const AUTH_HINT_STORAGE_KEY = "listen-to-learn-authenticated-v1";
const GUEST_TRAINER_STORAGE_KEY = "connected-speech-trainer-v1:anonymous";
const GUEST_PRESET_CREATED_AT = "1970-01-01T00:00:00.000Z";
const phraseSortOptions: Array<{ value: PhraseSort; label: string }> = [
  { value: "added_desc", label: "Added · newest first" },
  { value: "added_asc", label: "Added · oldest first" },
  { value: "alpha_asc", label: "Alphabetical · A–Z" },
  { value: "alpha_desc", label: "Alphabetical · Z–A" },
];

function phraseTieBreaker(a: Phrase, b: Phrase) {
  const catalogA = a.catalog_order ?? Number.MAX_SAFE_INTEGER;
  const catalogB = b.catalog_order ?? Number.MAX_SAFE_INTEGER;
  return catalogA - catalogB || a.id.localeCompare(b.id);
}

function comparePhrases(a: Phrase, b: Phrase, sort: PhraseSort) {
  if (sort === "alpha_asc" || sort === "alpha_desc") {
    const alphabetic = a.text.localeCompare(b.text, "en", { sensitivity: "base" });
    return (sort === "alpha_asc" ? alphabetic : -alphabetic) || phraseTieBreaker(a, b);
  }

  const aTime = Date.parse(a.created_at) || 0;
  const bTime = Date.parse(b.created_at) || 0;
  return (sort === "added_desc" ? bTime - aTime : aTime - bTime) || phraseTieBreaker(a, b);
}

function renderPattern(pattern: string) {
  const parts = pattern.split(/(\[[^\]]+\])/g).filter(Boolean);
  return parts.map((part, index) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <span className="sound-block" key={`${part}-${index}`}>{part.slice(1, -1)}</span>
    ) : <span key={`${part}-${index}`}>{part}</span>
  );
}

function guestPhrases(state: GuestLibraryState): Phrase[] {
  return [
    ...PRESET_PHRASES.map((phrase, index) => ({
      id: `preset-${index}`,
      text: phrase.text,
      pattern: phrase.pattern,
      ipa: phrase.ipa,
      translation: "",
      context: "",
      source_type: "preset" as const,
      catalog_order: index,
      status: state.statuses[`preset-${index}`] || "pick" as const,
      created_at: GUEST_PRESET_CREATED_AT,
      updated_at: GUEST_PRESET_CREATED_AT,
    })),
    ...state.customPhrases.map((phrase) => ({
      id: phrase.id,
      text: phrase.text,
      pattern: phrase.pattern,
      ipa: phrase.ipa,
      translation: phrase.translation,
      context: phrase.context,
      source_type: "custom" as const,
      catalog_order: null,
      status: phrase.status,
      created_at: phrase.createdAt,
      updated_at: phrase.updatedAt,
    })),
  ];
}

export default function Home() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [mode, setMode] = useState<"guest" | "account">("guest");
  const [guestLibrary, setGuestLibrary] = useState<GuestLibraryState>(() => createGuestLibrary());
  const [activeTab, setActiveTab] = useState<PhraseStatus>("pick");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [customText, setCustomText] = useState("");
  const [phraseSort, setPhraseSort] = useState<PhraseSort>("added_desc");
  const phraseSortReady = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(PHRASE_SORT_STORAGE_KEY);
        if (phraseSortOptions.some((option) => option.value === stored)) {
          setPhraseSort(stored as PhraseSort);
        }
      } catch {
        // Browser storage is optional; the default remains usable.
      } finally {
        phraseSortReady.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!phraseSortReady.current) return;
    try {
      window.localStorage.setItem(PHRASE_SORT_STORAGE_KEY, phraseSort);
    } catch {
      // Browser storage is optional; the current selection still applies.
    }
  }, [phraseSort]);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const persistGuestState = useCallback((next: GuestLibraryState) => {
    const normalized = normalizeGuestLibrary(next);
    setMode("guest");
    setViewer(null);
    setGuestLibrary(normalized);
    setPhrases(guestPhrases(normalized));
    try {
      window.localStorage.setItem(GUEST_LIBRARY_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      setNotice("Guest progress only lasts while this tab is open because localStorage is unavailable.");
    }
  }, []);

  const loadGuestState = useCallback(() => {
    let next = createGuestLibrary();
    try {
      const raw = window.localStorage.getItem(GUEST_LIBRARY_STORAGE_KEY);
      if (raw) next = normalizeGuestLibrary(JSON.parse(raw));
    } catch {
      setNotice("Could not read guest progress; starting with a clean state.");
    }
    setMode("guest");
    setViewer(null);
    setGuestLibrary(next);
    setPhrases(guestPhrases(next));
    setLoading(false);
  }, []);

  const loadAccount = useCallback(async () => {
    setMode("account");
    setLoading(true);
    try {
      const response = await fetch("/api/phrases", { cache: "no-store" });
      const data = await response.json() as PhrasesResponse;
      if (!response.ok || !data.user || typeof data.user.id !== "string") {
        throw new Error(data.error || "account session unavailable");
      }
      setViewer(data.user);
      try { window.localStorage.setItem(AUTH_HINT_STORAGE_KEY, "1"); } catch { /* optional hint */ }
      setPhrases(data.phrases);
      setLoading(false);
    } catch {
      try { window.localStorage.removeItem(AUTH_HINT_STORAGE_KEY); } catch { /* optional hint */ }
      loadGuestState();
    }
  }, [loadGuestState]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const signedIn = params.get("signedIn") === "1";
    if (signedIn) window.history.replaceState(null, "", window.location.pathname);

    let authHint = false;
    try { authHint = window.localStorage.getItem(AUTH_HINT_STORAGE_KEY) === "1"; } catch { /* optional hint */ }
    const timer = window.setTimeout(() => {
      if (signedIn || authHint) void loadAccount();
      else loadGuestState();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount, loadGuestState]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== GUEST_LIBRARY_STORAGE_KEY || mode !== "guest") return;
      loadGuestState();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadGuestState, mode]);

  const counts = useMemo(() => Object.fromEntries(
    tabs.map((tab) => [tab.id, phrases.filter((phrase) => phrase.status === tab.id).length])
  ) as Record<PhraseStatus, number>, [phrases]);

  const visible = useMemo(
    () => phrases
      .filter((phrase) => phrase.status === activeTab)
      .sort((a, b) => comparePhrases(a, b, phraseSort)),
    [activeTab, phraseSort, phrases]
  );

  async function changeStatus(id: string, status: PhraseStatus) {
    setBusyId(id);
    setError("");
    if (mode === "guest") {
      persistGuestState(setGuestPhraseStatus(guestLibrary, id, status));
      setActiveTab(status);
      setNotice("Guest progress is saved only in this browser.");
      setBusyId(null);
      return;
    }
    try {
      const response = await fetch("/api/phrases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json() as PhraseMutationResponse;
      if (!response.ok) throw new Error(data.error || "Could not update the phrase status.");
      setPhrases((currentPhrases) => currentPhrases.map((phrase) => phrase.id === id
        ? {
            ...phrase,
            status: data.status || status,
            translation: data.translation ?? phrase.translation,
            updated_at: data.updated_at || new Date().toISOString(),
          }
        : phrase));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the phrase status.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePhrase(phrase: Phrase) {
    if (phrase.source_type === "custom" && !window.confirm(`Remove “${phrase.text}”?`)) return;
    setBusyId(phrase.id);
    setError("");
    if (mode === "guest") {
      persistGuestState(removeGuestPhrase(guestLibrary, phrase.id));
      setActiveTab("pick");
      setNotice("Phrase removed from the guest library.");
      setBusyId(null);
      return;
    }
    try {
      const response = await fetch(`/api/phrases?id=${encodeURIComponent(phrase.id)}`, { method: "DELETE" });
      const data = await response.json() as PhraseMutationResponse;
      if (!response.ok) throw new Error(data.error || "Could not remove the phrase.");
      setPhrases((currentPhrases) => phrase.source_type === "preset"
        ? currentPhrases.map((currentPhrase) => currentPhrase.id === phrase.id
          ? { ...currentPhrase, status: "pick", updated_at: new Date().toISOString() }
          : currentPhrase)
        : currentPhrases.filter((currentPhrase) => currentPhrase.id !== phrase.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the phrase.");
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
    if (mode === "guest") {
      const existing = phrases.find((phrase) => phrase.text.toLocaleLowerCase("en") === text.toLocaleLowerCase("en"));
      if (existing) {
        const nextStatus = existing.status === "pick" ? "to_learn" : existing.status;
        persistGuestState(setGuestPhraseStatus(guestLibrary, existing.id, nextStatus));
        setCustomText("");
        setActiveTab(nextStatus);
        setNotice("This phrase was already in the guest library.");
      } else {
        const result = addGuestPhrase(guestLibrary, { text });
        if (result.phrase) {
          persistGuestState(result.state);
          setCustomText("");
          setActiveTab("to_learn");
          setNotice("Phrase added to the guest library. Translation is available after signing in with Google.");
        }
      }
      setBusyId(null);
      return;
    }
    try {
      const response = await fetch("/api/phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json() as PhraseMutationResponse;
      if (!response.ok) throw new Error(data.error || "Could not add the phrase.");
      setCustomText("");
      const nextStatus = data.status || "to_learn";
      const nextPhrase: Phrase = {
        id: data.id || `custom-${Date.now()}`,
        text,
        pattern: `[${text}]`,
        ipa: "",
        translation: data.translation || "",
        context: data.context || "",
        source_type: "custom",
        catalog_order: null,
        status: nextStatus,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      };
      setPhrases((currentPhrases) => {
        const existing = currentPhrases.some((phrase) => phrase.id === nextPhrase.id);
        return existing
          ? currentPhrases.map((phrase) => phrase.id === nextPhrase.id ? { ...phrase, ...nextPhrase } : phrase)
          : [...currentPhrases, nextPhrase];
      });
      setActiveTab(nextStatus);
      const translationNotice = data.translationPending ? " Translation is currently unavailable, but the phrase was saved." : "";
      setNotice(data.created === false ? `This phrase is already in your library.${translationNotice}` : `Phrase added to To Learn${data.translationPending ? ". Translation is currently unavailable." : " with a translation."}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add the phrase.");
    } finally {
      setBusyId(null);
    }
  }

  function openPhrase(phrase: Phrase) {
    const query = new URLSearchParams({ phrase: phrase.text, phraseId: phrase.id });
    window.location.assign(`/trainer?${query.toString()}`);
  }

  function resetGuest() {
    if (!window.confirm("Clear all guest progress in this browser?")) return;
    persistGuestState(createGuestLibrary());
    try { window.localStorage.removeItem(GUEST_TRAINER_STORAGE_KEY); } catch { /* optional storage */ }
    setActiveTab("pick");
    setNotice("Guest progress cleared.");
  }

  function clearAccountHint() {
    try { window.localStorage.removeItem(AUTH_HINT_STORAGE_KEY); } catch { /* optional storage */ }
  }

  const current = tabs.find((tab) => tab.id === activeTab)!;

  return (
    <main className="library-shell">
      <header className="library-header">
        <div>
          <p className="eyebrow">Connected speech trainer</p>
          <h1>Listen to real speech.<br />Choose what to learn.</h1>
        </div>
        <div className="header-tools">
          <a className="integrations-link" href="/integrations">Integrations</a>
          {viewer && <span className="header-account" title={viewer.email}>{viewer.name || viewer.email}</span>}
          {mode === "guest" ? (
            <>
              <button className="account-link" onClick={resetGuest} type="button">Clear guest data</button>
              <a className="account-link" href="/login">Sign in with Google</a>
            </>
          ) : (
            <a className="account-link" href="/cdn-cgi/access/logout" onClick={clearAccountHint}>Log out</a>
          )}
          <div className="header-total"><strong>{phrases.length}</strong><span>phrases in library</span></div>
        </div>
      </header>

      {mode === "guest" && <div className="notice" role="status">Guest mode: progress is stored only in this browser. Sign in with Google to save it to your account.</div>}

      <nav className="tabs" aria-label="Learning sections" role="tablist">
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
          <div className="section-tools">
            <label className="sort-control">
              <span>Sort</span>
              <select
                aria-label="Sort phrases"
                className="phrase-sort"
                onChange={(event) => setPhraseSort(event.target.value as PhraseSort)}
                value={phraseSort}
              >
                {phraseSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <form className="add-form" onSubmit={addCustom}>
              <input
                aria-label="Your word or phrase"
                maxLength={240}
                onChange={(event) => setCustomText(event.target.value)}
                placeholder="Enter a word or phrase"
                value={customText}
              />
              <button disabled={busyId === "new" || !customText.trim()} type="submit">+ To Learn</button>
            </form>
          </div>
        </div>

        {error && <div className="notice error" role="alert">{error}</div>}
        {notice && <div className="notice success" role="status">{notice}</div>}
        {loading ? <div className="notice">Loading library…</div> : visible.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing here yet</strong>
            <span>{activeTab === "pick" ? "All phrases have already been sorted." : "Move your first phrase here."}</span>
          </div>
        ) : (
          <div className="phrase-grid">
            {visible.map((phrase) => (
              <article className="phrase-card" key={phrase.id}>
                <button className="phrase-open" onClick={() => openPhrase(phrase)} type="button">
                  <span className="phrase-text">{phrase.text}</span>
                  {phrase.status !== "pick" && phrase.translation && (
                    <span className="phrase-translation">{phrase.translation}</span>
                  )}
                  {phrase.context && <span className="phrase-context">Context: {phrase.context}</span>}
                  <span className="phrase-pattern">{renderPattern(phrase.pattern)}</span>
                  <span className="phrase-ipa">{phrase.ipa || "Transcription will appear later"}</span>
                  <span className="listen-link">Listen <span aria-hidden="true">↗</span></span>
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
