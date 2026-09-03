"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PracticePhraseGrid } from "@/app/components/practice-phrase-grid";
import { SignedInSiteAccount } from "@/app/components/signed-in-site-account";
import { SiteNavigation } from "@/app/components/site-navigation";
import {
  readMigratedStorage,
  removeMigratedStorage,
  writeMigratedStorage,
} from "@/lib/browser-storage";
import type { CatalogAnalysis } from "@/lib/catalog/catalog-api";
import { mergeGuestCatalog, type WorkspacePhrase } from "@/lib/catalog/guest-catalog";
import {
  CONNECTED_SPEECH_MECHANISMS,
  LEGACY_PRESET_PHRASES,
  PRACTICE_FORMATS,
  type ConnectedSpeechMechanism,
  type PracticeFormat,
} from "@/lib/catalog/connected-speech-catalog";
import { accountSession, signInHref, type AccountSessionUser } from "@/lib/client-session";
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
import { filterPracticePhrases } from "@/lib/practice-list";

type PhraseStatus = "pick" | "to_learn" | "learning_now" | "learnt";
type Phrase = WorkspacePhrase;
type PhrasesResponse = { phrases: Phrase[]; user?: Viewer; error?: string };
type CatalogCard = { id: string; text: string; sourceType: "catalog"; analysis: CatalogAnalysis };
type CatalogResponse = { cards?: CatalogCard[]; error?: string };
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
  { id: "to_learn", label: "To Learn", hint: "saved for later" },
  { id: "learning_now", label: "Learning Now", hint: "what you are listening to now" },
  { id: "learnt", label: "Learned", hint: "already mastered" },
];

type PhraseSort = "recommended" | "added_desc" | "added_asc" | "alpha_asc" | "alpha_desc";

const PHRASE_SORT_STORAGE_KEY = "unmumble-library-sort-v1";
const LEGACY_PHRASE_SORT_STORAGE_KEYS = ["listen-to-learn-library-sort-v1"] as const;
const GUEST_TRAINER_STORAGE_KEY = "unmumble-trainer-v1:anonymous";
const LEGACY_GUEST_TRAINER_STORAGE_KEYS = ["connected-speech-trainer-v1:anonymous"] as const;

const practiceSortOptions: Array<{ value: PhraseSort; label: string }> = [
  { value: "added_desc", label: "Added · newest first" },
  { value: "added_asc", label: "Added · oldest first" },
  { value: "alpha_asc", label: "Alphabetical · A–Z" },
  { value: "alpha_desc", label: "Alphabetical · Z–A" },
];
const catalogSortOptions: Array<{ value: PhraseSort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "alpha_asc", label: "Alphabetical · A–Z" },
  { value: "alpha_desc", label: "Alphabetical · Z–A" },
];
const practiceFormatTabs = Object.entries(PRACTICE_FORMATS) as Array<[
  PracticeFormat,
  (typeof PRACTICE_FORMATS)[PracticeFormat],
]>;
const mechanismChoices = Object.entries(CONNECTED_SPEECH_MECHANISMS) as Array<[
  ConnectedSpeechMechanism,
  (typeof CONNECTED_SPEECH_MECHANISMS)[ConnectedSpeechMechanism],
]>;

function phraseTieBreaker(a: Phrase, b: Phrase) {
  const catalogA = a.catalog_order ?? Number.MAX_SAFE_INTEGER;
  const catalogB = b.catalog_order ?? Number.MAX_SAFE_INTEGER;
  return catalogA - catalogB || a.id.localeCompare(b.id);
}

function MobileFilterButton({
  activeCount,
  onClick,
}: {
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={`Open filters${activeCount > 0 ? ` (${activeCount} active)` : ""}`}
      className={`mobile-filter-trigger mobile-only${activeCount > 0 ? " has-active-filters" : ""}`}
      onClick={onClick}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="mobile-filter-icon"
        fill="none"
        height="15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="15"
      >
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      {activeCount > 0 ? (
        <span className="filter-count-badge">{activeCount}</span>
      ) : (
        <span aria-hidden="true" className="filter-caret" style={{ color: "var(--color-text-secondary)", fontSize: "11px", marginLeft: "1px" }}>⌄</span>
      )}
    </button>
  );
}

function SearchIcon({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      style={{ display: "block", flexShrink: 0 }}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function comparePhrases(a: Phrase, b: Phrase, sort: PhraseSort) {
  if (sort === "recommended") {
    return (a.analysis?.rank ?? Number.MAX_SAFE_INTEGER) - (b.analysis?.rank ?? Number.MAX_SAFE_INTEGER)
      || phraseTieBreaker(a, b);
  }
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

function PracticeAction({ onClick }: { onClick: () => void }) {
  return (
    <button aria-label="Open in trainer" className="phrase-play-btn listen-link" onClick={onClick} type="button">
      ▶
    </button>
  );
}

export function PhraseWorkspace({ surface }: { surface: "library" | "practice" }) {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [catalogCards, setCatalogCards] = useState<CatalogCard[]>([]);
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
  const [phraseSort, setPhraseSort] = useState<PhraseSort>(surface === "library" ? "recommended" : "added_desc");
  const [activeFormat, setActiveFormat] = useState<PracticeFormat>("atom");
  const [selectedMechanisms, setSelectedMechanisms] = useState<Set<ConnectedSpeechMechanism>>(new Set());
  const [openHelpKey, setOpenHelpKey] = useState<string | null>(null);
  const [practiceSources, setPracticeSources] = useState<Set<"catalog" | "custom">>(new Set(["catalog", "custom"]));
  const [catalogSearch, setCatalogSearch] = useState("");
  const [practiceSearch, setPracticeSearch] = useState("");
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [openMenuPhraseId, setOpenMenuPhraseId] = useState<string | null>(null);
  const phraseSortReady = useRef(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openHelpKey) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpenHelpKey(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenHelpKey(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openHelpKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = readMigratedStorage(
          window.localStorage,
          PHRASE_SORT_STORAGE_KEY,
          LEGACY_PHRASE_SORT_STORAGE_KEYS,
        );
        const storedSortOptions = surface === "library" ? catalogSortOptions : practiceSortOptions;
        if (storedSortOptions.some((option) => option.value === stored)) {
          setPhraseSort(stored as PhraseSort);
        }
      } catch {
        // Browser storage is optional; the default remains usable.
      } finally {
        phraseSortReady.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [surface]);

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
    setPhrases(mergeGuestCatalog(normalized, catalogCards, LEGACY_PRESET_PHRASES));
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
  }, [catalogCards]);

  const loadGuestState = useCallback(async () => {
    setLoading(true);
    setError("");
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
    try {
      const response = await fetch("/api/catalog");
      const data = await response.json() as CatalogResponse;
      if (!response.ok || !Array.isArray(data.cards)) {
        throw new Error(data.error || "Could not load the connected-speech catalog.");
      }
      setCatalogCards(data.cards);
      setPhrases(mergeGuestCatalog(next, data.cards, LEGACY_PRESET_PHRASES));
    } catch (reason) {
      setPhrases(mergeGuestCatalog(next, [], LEGACY_PRESET_PHRASES));
      setError(reason instanceof Error ? reason.message : "Could not load the connected-speech catalog.");
    } finally {
      setLoading(false);
    }
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
        else void loadGuestState();
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount, loadGuestState, surface]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        ![GUEST_LIBRARY_STORAGE_KEY, ...LEGACY_GUEST_LIBRARY_STORAGE_KEYS].includes(event.key || "")
        || mode !== "guest"
      ) return;
      void loadGuestState();
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

  const formatCounts = useMemo(() => Object.fromEntries(practiceFormatTabs.map(([kind]) => [
    kind,
    phrases.filter((phrase) => phrase.status === "pick" && phrase.analysis?.kind === kind).length,
  ])) as Record<PracticeFormat, number>, [phrases]);

  const mechanismCounts = useMemo(() => {
    const formatPhrases = phrases.filter((p) => p.status === "pick" && p.analysis?.kind === activeFormat);
    return Object.fromEntries(mechanismChoices.map(([mech]) => [
      mech,
      formatPhrases.filter((p) => p.analysis?.mechanisms.includes(mech)).length,
    ])) as Record<ConnectedSpeechMechanism, number>;
  }, [activeFormat, phrases]);

  const practiceSourceCounts = useMemo(() => ({
    catalog: phrases.filter((p) => p.status === activeTab && p.sourceType !== "custom").length,
    custom: phrases.filter((p) => p.status === activeTab && p.sourceType === "custom").length,
  }), [activeTab, phrases]);

  const sortedForSurface = useMemo(
    () => phrases
      .filter((phrase) => {
        if (surface === "library") {
          if (phrase.analysis?.kind === activeFormat) {
            if (selectedMechanisms.size > 0 && !phrase.analysis.mechanisms.some((m) => selectedMechanisms.has(m))) {
              return false;
            }
            if (catalogSearch.trim()) {
              const query = catalogSearch.trim().toLocaleLowerCase("en");
              const haystack = `${phrase.text} ${phrase.analysis.pattern} ${phrase.analysis.ipa}`.toLocaleLowerCase("en");
              return haystack.includes(query);
            }
            return true;
          }
          return false;
        }

        if (phrase.status !== activeTab) return false;
        if (practiceSources.size < 2) {
          if (!practiceSources.has("catalog") && phrase.sourceType !== "custom") return false;
          if (!practiceSources.has("custom") && phrase.sourceType === "custom") return false;
        }
        if (selectedMechanisms.size > 0) {
          if (!phrase.analysis || !phrase.analysis.mechanisms.some((m) => selectedMechanisms.has(m))) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => comparePhrases(a, b, phraseSort)),
    [activeFormat, activeTab, catalogSearch, phraseSort, phrases, practiceSources, selectedMechanisms, surface]
  );

  const visible = useMemo(
    () => surface === "practice"
      ? filterPracticePhrases(sortedForSurface, practiceSearch)
      : sortedForSurface,
    [practiceSearch, sortedForSurface, surface],
  );

  const libraryGroups = useMemo(() => {
    if (surface !== "library") return [];
    if (catalogSearch.trim() || selectedMechanisms.size > 0) {
      return [{
        key: "filtered",
        title: selectedMechanisms.size === 1
          ? CONNECTED_SPEECH_MECHANISMS[Array.from(selectedMechanisms)[0]].title
          : "Matching phrases",
        hint: selectedMechanisms.size === 1
          ? CONNECTED_SPEECH_MECHANISMS[Array.from(selectedMechanisms)[0]].hint
          : `${visible.length} cards found`,
        mechanismKey: selectedMechanisms.size === 1 ? Array.from(selectedMechanisms)[0] : null,
        rows: visible,
      }];
    }

    return mechanismChoices.map(([mechKey, mechDef]) => {
      const rows = sortedForSurface.filter((p) => p.analysis?.mechanisms.includes(mechKey));
      return {
        key: mechKey,
        title: mechDef.title,
        hint: mechDef.hint,
        mechanismKey: mechKey,
        rows,
      };
    }).filter((group) => group.rows.length > 0);
  }, [catalogSearch, selectedMechanisms, sortedForSurface, surface, visible]);

  async function changeStatus(id: string, status: PhraseStatus) {
    setBusyId(id);
    setError("");
    if (mode === "guest") {
      persistGuestState(setGuestPhraseStatus(guestLibrary, id, status));
      if (surface === "practice") setActiveTab(status);
      if (surface === "library" && status === "to_learn") {
        setRecentlyAdded(id);
      } else if (status === "to_learn") {
        setNotice("Added to To Learn. Guest progress is saved in this browser.");
      } else if (status === "pick") {
        setRecentlyAdded(null);
        setNotice("Returned to the catalog.");
      }
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
      if (surface === "library" && status === "to_learn") {
        setRecentlyAdded(id);
      } else if (status === "to_learn") {
        setNotice("Added to To Learn.");
      } else if (status === "pick") {
        setRecentlyAdded(null);
        setNotice("Returned to the catalog.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the phrase status.");
    } finally {
      setBusyId(null);
    }
  }

  async function undoAdded() {
    if (!recentlyAdded) return;
    await changeStatus(recentlyAdded, "pick");
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
    const text = (customText || practiceSearch).trim();
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
        setPracticeSearch("");
        setActiveTab(nextStatus);
        setNotice("This phrase was already in the guest library.");
      } else {
        const result = addGuestPhrase(guestLibrary, { text });
        if (result.phrase) {
          persistGuestState(result.state);
          setCustomText("");
          setPracticeSearch("");
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
      setPracticeSearch("");
      const nextStatus = data.status || "to_learn";
      if (data.created === false && data.id) {
        setPhrases((currentPhrases) => currentPhrases.map((phrase) => phrase.id === data.id
          ? {
              ...phrase,
              status: nextStatus,
              translation: data.translation ?? phrase.translation,
              context: data.context ?? phrase.context,
              updated_at: data.updated_at || phrase.updated_at,
            }
          : phrase));
        setActiveTab(nextStatus);
        const translationNotice = data.translationPending
          ? " Translation is currently unavailable, but the phrase was saved."
          : "";
        setNotice(`This phrase is already in your library.${translationNotice}`);
        return;
      }
      const nextPhrase: Phrase = {
        id: data.id || `custom-${Date.now()}`,
        text,
        pattern: text,
        ipa: "",
        translation: data.translation || "",
        context: data.context || "",
        source_type: "custom",
        sourceType: "custom",
        catalog_order: null,
        status: nextStatus,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        analysis: null,
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
    // /trainer is a static public HTML application outside the Next.js router
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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

  function toggleMechanism(mech: ConnectedSpeechMechanism) {
    setSelectedMechanisms((prev) => {
      const next = new Set(prev);
      if (next.has(mech)) next.delete(mech);
      else next.add(mech);
      return next;
    });
  }

  function togglePracticeSource(src: "catalog" | "custom") {
    setPracticeSources((prev) => {
      const next = new Set(prev);
      if (next.has(src)) {
        if (next.size > 1) next.delete(src);
      } else {
        next.add(src);
      }
      return next;
    });
  }

  function resetFilters() {
    if (surface === "library") {
      setActiveFormat("atom");
      setSelectedMechanisms(new Set());
      setCatalogSearch("");
    } else {
      setPracticeSources(new Set(["catalog", "custom"]));
      setSelectedMechanisms(new Set());
      setPracticeSearch("");
      setCustomText("");
    }
    setOpenHelpKey(null);
  }

  const sortOptions = surface === "library" ? catalogSortOptions : practiceSortOptions;
  const activeFiltersCount = surface === "library"
    ? (1 + selectedMechanisms.size)
    : (selectedMechanisms.size + (practiceSources.size < 2 ? 1 : 0));

  const getMechanismExample = useCallback((mech: ConnectedSpeechMechanism) => {
    const card = catalogCards.find((c) => c.analysis.mechanisms.includes(mech))
      || phrases.find((p) => p.analysis?.mechanisms.includes(mech));
    return card ? `${card.text} → ${card.analysis?.ipa || ""}` : "";
  }, [catalogCards, phrases]);

  const renderHelpButton = (mechKey: ConnectedSpeechMechanism, helpId: string, label: string) => {
    const isOpen = openHelpKey === helpId;
    const mech = CONNECTED_SPEECH_MECHANISMS[mechKey];
    const example = getMechanismExample(mechKey);

    return (
      <div className="help-question-wrap" ref={isOpen ? popoverRef : undefined}>
        <button
          aria-expanded={isOpen}
          aria-label={`Explain ${label}`}
          className={`help-question-btn${isOpen ? " active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpenHelpKey(isOpen ? null : helpId);
          }}
          type="button"
        >
          ?
        </button>
        {isOpen && (
          <div
            className="mechanism-popover"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            role="tooltip"
          >
            <div className="mechanism-popover-header">
              <strong className="popover-title">{mech.title}</strong>
              <button
                aria-label="Close explanation"
                className="popover-close-btn"
                onClick={() => setOpenHelpKey(null)}
                type="button"
              >
                ✕
              </button>
            </div>
            <p className="popover-desc">{mech.description}</p>
            {example && <span className="popover-example">{example}</span>}
          </div>
        )}
      </div>
    );
  };

  const renderFiltersContent = (isMobile = false) => (
    <>
      <div className="sidebar-header">
        <strong>Filters</strong>
        <button className="sidebar-reset-btn" onClick={resetFilters} type="button">Reset</button>
      </div>

      {surface === "library" ? (
        <div className="sidebar-section">
          <span className="sidebar-section-title">Practice format</span>
          <div className="format-options" role="radiogroup">
            {practiceFormatTabs.map(([kind, def]) => {
              const active = activeFormat === kind;
              const count = formatCounts[kind] ?? 0;
              return (
                <button
                  aria-checked={active}
                  className={`format-option-btn${active ? " active" : ""}`}
                  key={kind}
                  onClick={() => setActiveFormat(kind)}
                  role="radio"
                  type="button"
                >
                  <span className="radio-dot" />
                  <span className="format-title">{def.title}</span>
                  <span className="format-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="sidebar-section">
          <span className="sidebar-section-title">Source</span>
          <div className="format-options">
            <button
              aria-checked={practiceSources.has("catalog")}
              className={`format-option-btn${practiceSources.has("catalog") ? " active" : ""}`}
              onClick={() => togglePracticeSource("catalog")}
              role="checkbox"
              type="button"
            >
              <span className="checkbox-box">{practiceSources.has("catalog") ? "✓" : ""}</span>
              <span className="format-title">From catalog</span>
              <span className="format-count">{practiceSourceCounts.catalog}</span>
            </button>
            <button
              aria-checked={practiceSources.has("custom")}
              className={`format-option-btn${practiceSources.has("custom") ? " active" : ""}`}
              onClick={() => togglePracticeSource("custom")}
              role="checkbox"
              type="button"
            >
              <span className="checkbox-box">{practiceSources.has("custom") ? "✓" : ""}</span>
              <span className="format-title">Your phrases</span>
              <span className="format-count">{practiceSourceCounts.custom}</span>
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-section-title-wrap">
          <span className="sidebar-section-title">Mechanism</span>
          <span className="sidebar-section-hint">? explains it</span>
        </div>

        <div className="mechanism-list">
          {surface === "library" && (
            <button
              aria-checked={selectedMechanisms.size === 0}
              className={`mechanism-row-btn all-mechanisms-btn${selectedMechanisms.size === 0 ? " active" : ""}`}
              onClick={() => setSelectedMechanisms(new Set())}
              role="checkbox"
              type="button"
            >
              <span className="checkbox-box">{selectedMechanisms.size === 0 ? "✓" : ""}</span>
              <span className="mechanism-title">All mechanisms</span>
              <span className="format-count">{formatCounts[activeFormat] || 18}</span>
            </button>
          )}

          {mechanismChoices.map(([mechKey, mechDef]) => {
            const checked = selectedMechanisms.has(mechKey);
            const count = mechanismCounts[mechKey] || 0;
            return (
              <div className="mechanism-row-btn" key={mechKey}>
                <span
                  aria-checked={checked}
                  className={`checkbox-box${checked ? " checked" : ""}`}
                  onClick={() => toggleMechanism(mechKey)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleMechanism(mechKey);
                    }
                  }}
                  role="checkbox"
                  tabIndex={0}
                >
                  {checked ? "✓" : ""}
                </span>
                <div
                  className="mechanism-info"
                  onClick={() => toggleMechanism(mechKey)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleMechanism(mechKey);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="mechanism-title">{mechDef.title}</span>
                  <span className="mechanism-hint">{mechDef.hint}</span>
                </div>
                {renderHelpButton(mechKey, `filter:${mechKey}${isMobile ? "-mobile" : ""}`, mechDef.title)}
                {surface === "library" && <span className="format-count">{count}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  const renderPhraseCard = (phrase: Phrase) => {
    const isLibrary = surface === "library";
    const isLearningNow = phrase.status === "learning_now";
    const rankText = phrase.analysis?.rank
      ? String(phrase.analysis.rank).padStart(2, "0")
      : (phrase.sourceType === "custom" ? "—" : "01");

    return (
      <article
        className={`phrase-card ${isLibrary ? "catalog-row" : "practice-row"}${isLearningNow ? " highlighted" : ""}`}
        key={phrase.id}
      >
        <span className="row-rank">{rankText}</span>

        <div className={`phrase-open phrase-summary ${isLibrary ? "row-phrase" : "practice-row-main"}`}>
          <span className="phrase-type sr-only">
            {surface === "practice"
              ? phrase.sourceType === "custom"
                ? "Your phrase"
                : phrase.sourceType === "legacy"
                ? "Saved phrase"
                : phrase.analysis
                ? PRACTICE_FORMATS[phrase.analysis.kind]?.title || "Phrase"
                : "Phrase"
              : phrase.analysis
              ? `${PRACTICE_FORMATS[phrase.analysis.kind]?.title || "Phrase"} · #${phrase.analysis.rank}`
              : "Phrase"}
          </span>
          <span className={`phrase-text phrase-arc-text${isLearningNow ? " highlighted" : ""}`}>
            {phrase.analysis ? renderPattern(phrase.analysis.pattern) : phrase.text}
          </span>
          <PracticeAction onClick={() => openPhrase(phrase)} />

          {!isLibrary && (
            <span className="practice-row-sub">
              {phrase.sourceType === "custom"
                ? (phrase.translation ? `Your phrase · ${phrase.translation}` : "Your phrase")
                : phrase.sourceType === "legacy"
                ? (phrase.translation ? `Saved phrase · ${phrase.translation}` : "Saved phrase")
                : phrase.analysis
                ? `${PRACTICE_FORMATS[phrase.analysis.kind]?.title || "Phrase"} · ${phrase.analysis.mechanisms.map((m) => CONNECTED_SPEECH_MECHANISMS[m]?.title.split("&")[0].trim()).filter(Boolean).join(", ")}${isLearningNow ? " · last opened" : ""}`
                : "Your phrase"}
            </span>
          )}
          {surface === "practice" && phrase.status !== "pick" && phrase.translation && (
            <span className="phrase-translation">{phrase.translation}</span>
          )}
          {surface === "practice" && phrase.context && <span className="phrase-context sr-only">{phrase.context}</span>}
          {phrase.analysis && (
            <span className="phrase-pattern sr-only">{renderPattern(phrase.analysis.pattern)}</span>
          )}
        </div>

        {isLibrary ? (
          <span className="row-ipa phrase-ipa">{phrase.analysis?.ipa}</span>
        ) : null}

        <div className="card-actions row-actions-cell">
          {isLibrary ? (
            phrase.status === "pick" ? (
              <>
                <button
                  className={surface === "library" ? "save-action" : undefined}
                  disabled={busyId === phrase.id}
                  onClick={() => changeStatus(phrase.id, "to_learn")}
                  type="button"
                >
                  Add to Learn
                </button>
                <button
                  aria-label="Add to Learn"
                  className="mobile-add-btn mobile-only"
                  disabled={busyId === phrase.id}
                  onClick={() => changeStatus(phrase.id, "to_learn")}
                  type="button"
                >
                  <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="18">
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <span className="catalog-added-badge desktop-only" title="Added to your list">
                  <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Added</span>
                </span>
                <span aria-label="Added to your phrases" className="catalog-added-badge-mobile mobile-only" title="Added">
                  <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="18">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </>
            )
          ) : (
            <>
              {phrase.status === "to_learn" && <button className="action-btn-primary desktop-only" disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learning_now")} type="button">Move to Learning Now</button>}
              {phrase.status === "learning_now" && <button className="action-btn-primary desktop-only" disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learnt")} type="button">Mark as Learned</button>}
              {phrase.status === "learnt" && <button className="action-btn-primary desktop-only" disabled={busyId === phrase.id} onClick={() => changeStatus(phrase.id, "learning_now")} type="button">Learn Again</button>}
              {phrase.status !== "pick" && <button className="secondary" disabled={busyId === phrase.id} onClick={() => removePhrase(phrase)} type="button">Remove</button>}
              {phrase.status !== "pick" && (
                <button
                  aria-label="Options"
                  className="row-menu-btn mobile-only"
                  onClick={() => setOpenMenuPhraseId(openMenuPhraseId === phrase.id ? null : phrase.id)}
                  type="button"
                >
                  ⋯
                </button>
              )}
            </>
          )}
        </div>
      </article>
    );
  };

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
        <header className="library-header sr-only">
          <div>
            <p className="eyebrow">Unmumble</p>
            <h1>Train connected speech.</h1>
          </div>
          <div className="header-tools">
            {mode === "guest" && <button className="account-link" onClick={resetGuest} type="button">Clear guest data</button>}
          </div>
        </header>

        {error && <aside className="notice error" role="alert">{error}</aside>}
        {notice && surface !== "library" && (
          <aside className="notice success notice-action" role="status">
            <span>{notice}</span>
            {recentlyAdded && (
              <button onClick={undoAdded} type="button">Undo</button>
            )}
          </aside>
        )}

        <div className="workspace-layout">
          <aside aria-label="Filters" className="workspace-sidebar desktop-only">
            {renderFiltersContent(false)}
          </aside>

          <section className="workspace-main">
            <div className="workspace-top-heading">
              <h2>{surface === "library" ? "Catalog" : "Practice"}</h2>
              <span className="meta">
                {surface === "library" ? (
                  <>
                    {visible.length} cards · {PRACTICE_FORMATS[activeFormat].title.toLowerCase()} ·{" "}
                    <span style={{ color: "var(--color-text-secondary)" }}>▶ opens the trainer</span>
                  </>
                ) : (
                  `${visible.length} phrases · ${counts.learning_now || 0} in progress`
                )}
              </span>
            </div>

            {surface === "library" && (
              <>
                <div className="catalog-search-bar">
                  <div className="search-field">
                    <SearchIcon className="search-field-icon" size={17} />
                    <input
                      aria-label="Search the catalog"
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      placeholder="Search phrase or sound"
                      type="search"
                      value={catalogSearch}
                    />
                  </div>
                  <MobileFilterButton
                    activeCount={activeFiltersCount}
                    onClick={() => setMobileFilterOpen(true)}
                  />
                  <div className="sort-select-wrap desktop-only">
                    <select
                      aria-label="Sort catalog"
                      className="sort-select phrase-sort"
                      onChange={(event) => setPhraseSort(event.target.value as PhraseSort)}
                      value={phraseSort}
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <span aria-hidden="true" className="sort-select-arrow">⌄</span>
                  </div>
                </div>

                <div className="mobile-chips-scroll mobile-only">
                  <span className="mobile-chip">
                    {PRACTICE_FORMATS[activeFormat].title}
                  </span>
                  {selectedMechanisms.size > 0 && Array.from(selectedMechanisms).map((m) => (
                    <button
                      className="mobile-chip"
                      key={m}
                      onClick={() => toggleMechanism(m)}
                      type="button"
                    >
                      {CONNECTED_SPEECH_MECHANISMS[m].title.split("&")[0].trim()}
                      <span aria-hidden="true" style={{ color: "#aee8ff" }}>✕</span>
                    </button>
                  ))}
                  {(selectedMechanisms.size > 0 || catalogSearch) && (
                    <button className="mobile-clear-btn" onClick={resetFilters} type="button">
                      Clear all
                    </button>
                  )}
                </div>

                <div className="catalog-groups">
                  {loading ? (
                    <div className="empty-state"><span>Loading catalog...</span></div>
                  ) : libraryGroups.length === 0 ? (
                    <div className="empty-state">
                      <strong>No matching cards found</strong>
                      <span>Try adjusting your filters or search term.</span>
                    </div>
                  ) : (
                    libraryGroups.map((group) => {
                      const isHelpOpen = openHelpKey === `group:${group.key}`;
                      return (
                        <div className={`catalog-group-card${isHelpOpen ? " has-open-help" : ""}`} key={group.key}>
                          <div className="catalog-group-header">
                            <span className="group-title">{group.title}</span>
                            {group.mechanismKey ? (
                              renderHelpButton(group.mechanismKey, `group:${group.key}`, group.title)
                            ) : (
                              <span className="help-question-placeholder" />
                            )}
                            <span className="group-hint">{group.hint}</span>
                            <span className="group-count">{String(group.rows.length).padStart(2, "0")}</span>
                          </div>
                          {group.rows.map(renderPhraseCard)}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {surface === "practice" && (
              <>
                {surface === "practice" && <form className="add-form custom-phrase-form" onSubmit={addCustom}>
                  <label className="sr-only" htmlFor="practice-search-input">Search your phrases</label>
                  <div className="practice-single-input-row">
                    <div className="practice-single-input-wrap">
                      <SearchIcon className="search-field-icon desktop-only" size={17} />
                      <input
                        id="practice-search-input"
                        onChange={(event) => setPracticeSearch(event.target.value)}
                        placeholder="Search or add a new word"
                        type="text"
                        value={practiceSearch}
                      />
                    </div>
                    <button
                      className="practice-search-btn desktop-only"
                      onClick={() => {
                        const input = document.getElementById("practice-search-input");
                        input?.focus();
                      }}
                      type="button"
                    >
                      Search
                    </button>
                    <button
                      className="practice-add-btn desktop-only"
                      disabled={busyId === "new" || !practiceSearch.trim()}
                      type="submit"
                    >
                      + To Learn
                    </button>
                    <button
                      aria-label="Search"
                      className="practice-icon-btn practice-search-icon-btn mobile-only"
                      onClick={() => {
                        const input = document.getElementById("practice-search-input");
                        input?.focus();
                      }}
                      title="Search"
                      type="button"
                    >
                      <SearchIcon size={19} />
                    </button>
                    <button
                      aria-label="Add to Learn"
                      className={`practice-icon-btn practice-add-icon-btn mobile-only${practiceSearch.trim() ? " has-text" : ""}`}
                      disabled={busyId === "new" || !practiceSearch.trim()}
                      title="Add to Learn"
                      type="submit"
                    >
                      <svg
                        aria-hidden="true"
                        fill="none"
                        height="18"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        style={{ display: "block", flexShrink: 0 }}
                        viewBox="0 0 24 24"
                        width="18"
                      >
                        <line x1="12" x2="12" y1="5" y2="19" />
                        <line x1="5" x2="19" y1="12" y2="12" />
                      </svg>
                    </button>
                    <MobileFilterButton
                      activeCount={activeFiltersCount}
                      onClick={() => setMobileFilterOpen(true)}
                    />
                  </div>

                  <div className="practice-input-helper-row">
                    <span>One field: search what you have, or add what you just heard. Text is enough — phonetics are optional.</span>
                    <div className="sort-select-wrap desktop-only" style={{ marginLeft: "auto" }}>
                      <select
                        aria-label="Sort phrases"
                        className="sort-select phrase-sort"
                        onChange={(event) => setPhraseSort(event.target.value as PhraseSort)}
                        value={phraseSort}
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <span aria-hidden="true" className="sort-select-arrow">⌄</span>
                    </div>
                  </div>
                </form>}

                <div className="mobile-status-chips mobile-only">
                  {practiceTabs.map((tab) => {
                    const active = activeTab === tab.id;
                    const count = counts[tab.id] || 0;
                    return (
                      <button
                        className={`mobile-status-chip${active ? " active" : ""}`}
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        type="button"
                      >
                        <span>{tab.label}</span>
                        <span style={{ fontWeight: 800, color: active ? "var(--color-interactive-link)" : undefined }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div aria-label="Learning sections" className="practice-tabs tabs desktop-only" role="tablist">
                  {practiceTabs.map((tab) => {
                    const active = activeTab === tab.id;
                    const count = counts[tab.id] || 0;
                    return (
                      <button
                        aria-selected={active}
                        className={`practice-tab-card tab${active ? " active" : ""}`}
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        role="tab"
                        type="button"
                      >
                        <span className="tab-labels">
                          <b>{tab.label}</b>
                          <small>{tab.hint}</small>
                        </span>
                        <strong className="tab-counter">{count}</strong>
                      </button>
                    );
                  })}
                </div>

                {loading ? (
                  <div className="empty-state"><span>Loading phrases...</span></div>
                ) : visible.length === 0 ? (
                  <div className="empty-state">
                    <strong>Nothing here yet</strong>
                    <span>
                      {activeTab === "learning_now"
                        ? "Start a phrase from To Learn or add one above."
                        : activeTab === "to_learn"
                        ? "Save phrases from the catalog or type your own above."
                        : "Phrases you complete in the trainer will appear here."}
                    </span>
                  </div>
                ) : surface === "practice" ? (
                  <PracticePhraseGrid items={visible} renderItem={renderPhraseCard} />
                ) : (
                  <div className="phrase-grid">
                    {visible.map(renderPhraseCard)}
                  </div>
                )}
              </>
            )}

            {mode === "guest" && (
              <div className="mobile-guest-card mobile-only">
                <span style={{ color: "var(--color-text-secondary)" }}>Progress is saved in this browser</span>
                <a className="site-account-link" href={signInHref(surface === "practice" ? "/practice" : "/library")}>
                  Sign in
                </a>
              </div>
            )}
          </section>
        </div>

        {mobileFilterOpen && (
          <>
            <button aria-label="Close filters" className="sheet-backdrop" onClick={() => setMobileFilterOpen(false)} type="button" />
            <div className="bottom-sheet" role="dialog" aria-modal="true">
              <div className="sheet-drag-handle" />
              <div className="sheet-scroll-body">
                {renderFiltersContent(true)}
              </div>
              <div className="sheet-footer-sticky">
                <button
                  className="sheet-apply-cta"
                  onClick={() => setMobileFilterOpen(false)}
                  type="button"
                >
                  Show {visible.length} cards
                </button>
              </div>
            </div>
          </>
        )}

        {openMenuPhraseId && (() => {
          const menuPhrase = phrases.find((p) => p.id === openMenuPhraseId);
          if (!menuPhrase) return null;
          const isLearningNow = menuPhrase.status === "learning_now";
          const isToLearn = menuPhrase.status === "to_learn";
          const isLearnt = menuPhrase.status === "learnt";

          return (
            <>
              <button aria-label="Close actions" className="sheet-backdrop" onClick={() => setOpenMenuPhraseId(null)} type="button" />
              <div aria-modal="true" className="bottom-sheet phrase-options-sheet" role="dialog">
                <div className="sheet-drag-handle" />
                <div className="phrase-sheet-header">
                  <strong className="phrase-sheet-title">{menuPhrase.text}</strong>
                  {menuPhrase.translation ? (
                    <span className="phrase-sheet-sub">{menuPhrase.translation}</span>
                  ) : menuPhrase.context ? (
                    <span className="phrase-sheet-sub">{menuPhrase.context}</span>
                  ) : null}
                </div>
                <div className="phrase-sheet-actions">
                  {isToLearn && (
                    <button
                      className="sheet-action-btn action-primary"
                      disabled={busyId === menuPhrase.id}
                      onClick={async () => {
                        await changeStatus(menuPhrase.id, "learning_now");
                        setOpenMenuPhraseId(null);
                      }}
                      type="button"
                    >
                      Move to Learning Now
                    </button>
                  )}
                  {isLearningNow && (
                    <button
                      className="sheet-action-btn action-primary"
                      disabled={busyId === menuPhrase.id}
                      onClick={async () => {
                        await changeStatus(menuPhrase.id, "learnt");
                        setOpenMenuPhraseId(null);
                      }}
                      type="button"
                    >
                      Mark as Learned
                    </button>
                  )}
                  {isLearnt && (
                    <button
                      className="sheet-action-btn action-primary"
                      disabled={busyId === menuPhrase.id}
                      onClick={async () => {
                        await changeStatus(menuPhrase.id, "learning_now");
                        setOpenMenuPhraseId(null);
                      }}
                      type="button"
                    >
                      Learn Again
                    </button>
                  )}
                  <button
                    className="sheet-action-btn action-danger"
                    disabled={busyId === menuPhrase.id}
                    onClick={async () => {
                      await removePhrase(menuPhrase);
                      setOpenMenuPhraseId(null);
                    }}
                    type="button"
                  >
                    Remove from Library
                  </button>
                  <button
                    className="sheet-action-btn action-cancel"
                    onClick={() => setOpenMenuPhraseId(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </main>
    </>
  );
}
