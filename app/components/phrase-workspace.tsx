"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignedInSiteAccount } from "@/app/components/signed-in-site-account";
import { SiteNavigation } from "@/app/components/site-navigation";
import {
  readMigratedStorage,
  removeMigratedStorage,
  writeMigratedStorage,
} from "@/lib/browser-storage";
import { accountSession, signInHref, type AccountSessionUser } from "@/lib/client-session";
import { PRESET_PHRASES } from "@/lib/preset-phrases";
import {
  GUEST_LIBRARY_STORAGE_KEY,
  LEGACY_GUEST_LIBRARY_STORAGE_KEYS,
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
type Viewer = AccountSessionUser;

const practiceTabs: Array<{ id: Exclude<PhraseStatus, "pick">; label: string; hint: string }> = [
  { id: "to_learn", label: "To Learn", hint: "Saved for later." },
  { id: "learning_now", label: "Learning Now", hint: "What you are listening to now." },
  { id: "learnt", label: "Learned", hint: "Phrases you have already mastered." },
];

type PhraseSort = "added_desc" | "added_asc" | "alpha_asc" | "alpha_desc";

const PHRASE_SORT_STORAGE_KEY = "unmumble-library-sort-v1";
const LEGACY_PHRASE_SORT_STORAGE_KEYS = ["listen-to-learn-library-sort-v1"] as const;
const GUEST_TRAINER_STORAGE_KEY = "unmumble-trainer-v1:anonymous";
const LEGACY_GUEST_TRAINER_STORAGE_KEYS = ["connected-speech-trainer-v1:anonymous"] as const;
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

export function PhraseWorkspace({ surface }: { surface: "library" | "practice" }) {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [mode, setMode] = useState<"guest" | "account">("guest");
  const [guestLibrary, setGuestLibrary] = useState<GuestLibraryState>(() => createGuestLibrary());
  const [activeTab, setActiveTab] = useState<PhraseStatus>(
    surface === "practice" ? "learning_now" : "pick",
  );
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
        const stored = readMigratedStorage(
          window.localStorage,
          PHRASE_SORT_STORAGE_KEY,
          LEGACY_PHRASE_SORT_STORAGE_KEYS,
        );
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
      writeMigratedStorage(
        window.localStorage,
        PHRASE_SORT_STORAGE_KEY,
        LEGACY_PHRASE_SORT_STORAGE_KEYS,
        phraseSort,
      );
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
      writeMigratedStorage(
        window.localStorage,
        GUEST_LIBRARY_STORAGE_KEY,
        LEGACY_GUEST_LIBRARY_STORAGE_KEYS,
        JSON.stringify(normalized),
      );
    } catch {
      setNotice("Guest progress only lasts while this tab is open because localStorage is unavailable.");
    }
  }, []);

  const loadGuestState = useCallback(() => {
    let next = createGuestLibrary();
    try {
      const raw = readMigratedStorage(
        window.localStorage,
        GUEST_LIBRARY_STORAGE_KEY,
        LEGACY_GUEST_LIBRARY_STORAGE_KEYS,
      );
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

  const loadAccount = useCallback(async (sessionUser: AccountSessionUser) => {
    setMode("account");
    setViewer(sessionUser);
    setLoading(true);
    try {
      const response = await fetch("/api/phrases", { cache: "no-store" });
      const data = await response.json() as PhrasesResponse;
      if (!response.ok || !Array.isArray(data.phrases)) {
        throw new Error(data.error || "account session unavailable");
      }
      setViewer(data.user || sessionUser);
      setPhrases(data.phrases);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load account phrases.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const signedIn = params.get("signedIn") === "1";
    if (signedIn) window.history.replaceState(null, "", window.location.pathname);

    const timer = window.setTimeout(() => {
      void accountSession().then((sessionUser) => {
        if (sessionUser) void loadAccount(sessionUser);
        else loadGuestState();
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount, loadGuestState]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        ![GUEST_LIBRARY_STORAGE_KEY, ...LEGACY_GUEST_LIBRARY_STORAGE_KEYS].includes(event.key || "")
        || mode !== "guest"
      ) return;
      loadGuestState();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadGuestState, mode]);

  const counts = useMemo(() => Object.fromEntries(
    ["pick", ...practiceTabs.map((tab) => tab.id)].map((status) => [
      status,
      phrases.filter((phrase) => phrase.status === status).length,
    ])
  ) as Record<PhraseStatus, number>, [phrases]);

  const visible = useMemo(
    () => phrases
      .filter((phrase) => surface === "library"
        ? phrase.status === "pick"
        : phrase.status === activeTab)
      .sort((a, b) => comparePhrases(a, b, phraseSort)),
    [activeTab, phraseSort, phrases, surface]
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
      if (surface === "practice") setActiveTab(data.status || status);
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
    try {
      removeMigratedStorage(
        window.localStorage,
        GUEST_TRAINER_STORAGE_KEY,
        LEGACY_GUEST_TRAINER_STORAGE_KEYS,
      );
    } catch { /* optional storage */ }
    setActiveTab(surface === "practice" ? "learning_now" : "pick");
    setNotice("Guest progress cleared.");
  }

  const current = surface === "library"
    ? { id: "pick", label: "New phrases", hint: "Choose phrases to add to your practice queue." }
    : practiceTabs.find((tab) => tab.id === activeTab) || practiceTabs[1];

  return (
    <>
      <SiteNavigation
        active={surface}
        account={mode === "guest" || !viewer ? (
          <a className="site-account-link" href={signInHref(surface === "practice" ? "/practice" : "/library")}>Sign in with Google</a>
        ) : (
          <SignedInSiteAccount user={viewer} />
        )}
      />
      <main className="library-shell">
      <header className="library-header">
        <div>
          <p className="eyebrow">Unmumble</p>
          <h1>{surface === "library" ? (
            <>Find useful phrases.<br />Choose what to learn.</>
          ) : (
            <>Practice your phrases.<br />Learn through real speech.</>
          )}</h1>
        </div>
        <div className="header-tools">
          {mode === "guest" && <button className="account-link" onClick={resetGuest} type="button">Clear guest data</button>}
          <div className="header-total">
            <strong>{surface === "library" ? counts.pick : phrases.length - counts.pick}</strong>
            <span>{surface === "library" ? "new phrases" : "phrases in practice"}</span>
          </div>
        </div>
      </header>

      {mode === "guest" && <div className="notice" role="status">Guest mode: progress is stored only in this browser. Sign in with Google to save it to your account.</div>}

      {surface === "practice" && (
      <nav className="tabs" aria-label="Learning sections" role="tablist">
        {practiceTabs.map((tab) => (
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
      )}

      <section className="library-section" role={surface === "practice" ? "tabpanel" : undefined}>
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
            {surface === "library" && <form className="add-form" onSubmit={addCustom}>
              <input
                aria-label="Your word or phrase"
                maxLength={240}
                onChange={(event) => setCustomText(event.target.value)}
                placeholder="Enter a word or phrase"
                value={customText}
              />
              <button disabled={busyId === "new" || !customText.trim()} type="submit">+ To Learn</button>
            </form>}
          </div>
        </div>

        {error && <div className="notice error" role="alert">{error}</div>}
        {notice && <div className="notice success" role="status">{notice}</div>}
        {loading ? <div className="notice">Loading library…</div> : visible.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing here yet</strong>
            <span>{surface === "library"
              ? "All available phrases have been added to Practice."
              : activeTab === "learning_now"
              ? "Start a phrase from To Learn."
              : "Move your first phrase here."}</span>
          </div>
        ) : (
          <div className="phrase-grid">
            {visible.map((phrase) => (
              <article className="phrase-card" key={phrase.id}>
                {surface === "practice" ? (
                <button className="phrase-open" onClick={() => openPhrase(phrase)} type="button">
                  <span className="phrase-text">{phrase.text}</span>
                  {phrase.status !== "pick" && phrase.translation && (
                    <span className="phrase-translation">{phrase.translation}</span>
                  )}
                  {phrase.context && <span className="phrase-context">Context: {phrase.context}</span>}
                  <span className="phrase-pattern">{renderPattern(phrase.pattern)}</span>
                  <span className="phrase-ipa">{phrase.ipa || "Transcription will appear later"}</span>
                  <span className="listen-link">Practice <span aria-hidden="true">↗</span></span>
                </button>
                ) : (
                <div className="phrase-open phrase-summary">
                  <span className="phrase-text">{phrase.text}</span>
                  <span className="phrase-pattern">{renderPattern(phrase.pattern)}</span>
                  <span className="phrase-ipa">{phrase.ipa || "Transcription will appear later"}</span>
                </div>
                )}
                <div className="card-actions">
                  {phrase.status === "pick" && <button disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "to_learn")} type="button">Add to Learn</button>}
                  {phrase.status === "to_learn" && <button disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learning_now")} type="button">Start Learning</button>}
                  {phrase.status === "learning_now" && <button disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learnt")} type="button">Mark as Learned</button>}
                  {phrase.status === "learnt" && <button disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learning_now")} type="button">Learn Again</button>}
                  {phrase.status !== "pick" && <button className="secondary" disabled={busyId === phrase.id} onClick={() => removePhrase(phrase)} type="button">Remove</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </main>
    </>
  );
}
