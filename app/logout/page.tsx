"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteNavigation } from "@/app/components/site-navigation";
import { completeSignOut } from "@/lib/client-session";

export default function LogoutPage() {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void completeSignOut().then((completed) => {
      if (!completed) setFailed(true);
    });
  }, []);

  return (
    <>
      <SiteNavigation active="library" />
      <main className="library-shell">
        <p className="eyebrow">Account</p>
        <h1>{failed ? "Could not sign out" : "Signing you out…"}</h1>
        <p>
          {failed
            ? "Your Access session could not be closed. Retry, or return to the site without signing out."
            : "You will return to the library in a moment."}
        </p>
        {failed && (
          <p>
            <button className="primary" onClick={() => window.location.reload()} type="button">Retry</button>{" "}
            <Link href="/">Return to Library</Link>
          </p>
        )}
      </main>
    </>
  );
}
