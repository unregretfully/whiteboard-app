"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type Profile = {
  username: string;
  is_premium: boolean;
  is_founder: boolean;
};

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(u: User | null) {
      if (!u) {
        if (!cancelled) setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("username, is_premium, is_founder")
        .eq("id", u.id)
        .single();
      if (!cancelled) setProfile(data ?? null);
    }

    // Covers page loads where someone is already logged in
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      loadProfile(u).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });

    // Covers logging in and out while the page is open
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      // Deferred on purpose: Supabase can deadlock if you query inside this callback
      setTimeout(() => loadProfile(u), 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}