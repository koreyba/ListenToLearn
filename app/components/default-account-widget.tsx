"use client";

import { useEffect, useState } from "react";
import { accountSession, signInHref, type AccountSessionUser } from "@/lib/client-session";
import { SignedInSiteAccount } from "@/app/components/signed-in-site-account";
import type { SiteSection } from "@/app/components/site-navigation";

export function DefaultAccountWidget({ active }: { active: SiteSection }) {
  const [user, setUser] = useState<AccountSessionUser | null>(null);

  useEffect(() => {
    let activeEffect = true;
    void accountSession().then((sessionUser) => {
      if (!activeEffect) return;
      setUser(sessionUser);
    });
    return () => {
      activeEffect = false;
    };
  }, []);

  if (user) {
    return <SignedInSiteAccount user={user} />;
  }

  const returnTo = active === "home" ? "/" : `/${active}`;
  return (
    <a className="site-account-link" href={signInHref(returnTo)}>
      Sign in with Google
    </a>
  );
}
