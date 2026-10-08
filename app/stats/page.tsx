"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Stats = { users: number; premium_users: number; pages_created: number };

export default function StatsPage() {
  const [isDark, setIsDark] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mediaQuery.matches);
    function handleChange(e: MediaQueryListEvent) {
      setIsDark(e.matches);
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    document.title = "Stats – Notebooook";
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await supabase.rpc("site_stats");
    if (error || !data) {
      console.error("Stats failed:", error);
      setFailed(true);
    } else {
      setStats(data as Stats);
      setFailed(false);
      setUpdatedAt(new Date());
    }
    setRefreshing(false);
  }, []);

  // Loads on open, then refreshes itself every 20 seconds
  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#a3a3a3" : "#666666",
    border: isDark ? "#2a2a2a" : "#ececec",
    outlineBorder: isDark ? "#333333" : "#dddddd",
  };

  const cards: { label: string; value: number | undefined }[] = [
    { label: "NB users", value: stats?.users },
    { label: "NB+ users", value: stats?.premium_users },
    { label: "Pages created", value: stats?.pages_created },
  ];

  const refreshStyle: CSSProperties = {
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "inherit",
    borderRadius: 8,
    cursor: refreshing ? "default" : "pointer",
    border: `1px solid ${colors.outlineBorder}`,
    background: "transparent",
    color: colors.text,
    opacity: refreshing ? 0.6 : 1,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflowY: "auto",
        background: colors.background,
        fontFamily: "var(--font-funnel-sans), Arial, sans-serif",
      }}
    >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 28px",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Link href="/">
          <img
            src="/logo.png"
            alt="Notebooook"
            style={{ height: 26, display: "block", filter: isDark ? "invert(1)" : "none" }}
          />
        </Link>
      </nav>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px", textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: colors.text, margin: "0 0 32px" }}>
          NoteBooook in numbers
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 20,
          }}
        >
          {cards.map((c) => (
            <div
              key={c.label}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: "28px 16px",
              }}
            >
              <div style={{ fontSize: 44, fontWeight: 700, color: colors.text }}>
                {c.value === undefined ? "–" : c.value.toLocaleString()}
              </div>
              <div style={{ fontSize: 14, color: colors.subtext, marginTop: 6 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {failed && (
          <p style={{ color: colors.subtext, fontSize: 14, marginTop: 24 }}>
            Couldn't load the numbers right now.
          </p>
        )}

        <div style={{ marginTop: 28, display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
          <button onClick={load} disabled={refreshing} style={refreshStyle}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {updatedAt && (
            <span style={{ fontSize: 13, color: colors.subtext }}>
              Updated {updatedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </main>
    </div>
  );
}