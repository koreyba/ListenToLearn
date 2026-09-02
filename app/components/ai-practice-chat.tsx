"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { SignedInSiteAccount } from "@/app/components/signed-in-site-account";
import { SiteNavigation } from "@/app/components/site-navigation";
import { accountSession, signInHref, type AccountSessionUser } from "@/lib/client-session";

const ChatWorkspace = lazy(() =>
  import("@/app/components/ai-chat-workspace").then((module) => ({
    default: module.ChatWorkspace,
  }))
);

export function AiPracticeChat() {
  const [viewer, setViewer] = useState<AccountSessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [returnTo, setReturnTo] = useState("/chat");

  useEffect(() => {
    let active = true;
    void accountSession().then((user) => {
      if (!active) return;
      setReturnTo(`${window.location.pathname}${window.location.search}`);
      setViewer(user);
      setSessionReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  let account: React.ReactNode;
  if (viewer) {
    account = <SignedInSiteAccount user={viewer} />;
  } else if (sessionReady) {
    account = <a className="site-account-link" href={signInHref(returnTo)}>Sign in</a>;
  } else {
    account = <span aria-live="polite" className="site-account-name">Checking account…</span>;
  }

  let chatContent: React.ReactNode;
  if (!sessionReady) {
    chatContent = <p aria-live="polite" className="ai-chat-account-state">Checking your account…</p>;
  } else if (viewer) {
    chatContent = (
      <Suspense fallback={<p aria-live="polite" className="ai-chat-account-state">Loading your chats…</p>}>
        <ChatWorkspace />
      </Suspense>
    );
  } else {
    chatContent = (
      <section className="ai-chat-sign-in">
        <h2>Keep the words and the conversation together</h2>
        <p>Sign in with Google to start and keep your practice chats.</p>
        <a className="landing-button landing-button-primary" href={signInHref(returnTo)}>
          Sign in with Google
        </a>
      </section>
    );
  }

  return (
    <>
      <SiteNavigation active="chat" account={account} />
      <main className="ai-chat-shell">
        <section className="ai-chat-intro" aria-labelledby="ai-chat-title">
          <div>
            <p className="ai-chat-kicker">AI vocabulary practice</p>
            <h1 id="ai-chat-title">Turn words into conversation</h1>
          </div>
          <p>Practice in context, then select any useful phrase to translate or add to learning.</p>
        </section>
        {chatContent}
      </main>
    </>
  );
}
