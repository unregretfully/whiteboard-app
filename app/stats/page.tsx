"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { InteractiveGrid } from "../../components/InteractiveGrid";

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
    document.title = "Stats – NoteBooook";
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
    grid: isDark ? "#2a2a2a" : "#eaeaea",
    gridHighlight: isDark ? "#8f8f8f" : "#6f6f6f",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#a3a3a3" : "#666666",
    border: isDark ? "#2a2a2a" : "#ececec",
    cardBg: isDark ? "#161616" : "#fafafa",
  };

  const cards: { label: string; value: number | undefined }[] = [
    { label: "Users", value: stats?.users },
    { label: "NB+ users", value: stats?.premium_users },
    { label: "Pages created", value: stats?.pages_created },
  ];

  const refreshStyle: CSSProperties = {
    padding: "10px 20px",
    fontSize: 15,
    fontWeight: 500,
    fontFamily: "inherit",
    borderRadius: 10,
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
      <InteractiveGrid gridColor={colors.grid} highlightColor={colors.gridHighlight} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <nav
          style={{
            height: 60,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            background: colors.background,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <Link href="/">
            <img
              src="/logo.png"
              alt="NoteBooook"
              style={{ height: 26, display: "block", filter: isDark ? "invert(1)" : "none" }}
            />
          </Link>
        </nav>

        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "48px 24px 72px",
          }}
        >
          <h1 style={{ fontSize: 44, fontWeight: 700, color: colors.text, margin: "0 0 12px" }}>
            NoteBooook in numbers
          </h1>
          <p style={{ fontSize: 16, color: colors.subtext, margin: "0 0 48px" }}>
            Live numbers, updated every 20 seconds.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 28,
              width: "100%",
              maxWidth: 1000,
            }}
          >
            {cards.map((c) => (
              <div
                key={c.label}
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 18,
                  padding: "56px 24px",
                }}
              >
                <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, color: colors.text }}>
                  {c.value === undefined ? "–" : c.value.toLocaleString()}
                </div>
                <div style={{ fontSize: 17, color: colors.subtext, marginTop: 16 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {failed && (
            <p style={{ color: colors.subtext, fontSize: 14, marginTop: 28 }}>
              Couldn't load the numbers right now.
            </p>
          )}

          <div
            style={{
              marginTop: 40,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 16,
            }}
          >
            <button onClick={load} disabled={refreshing} className="nb-btn" style={refreshStyle}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {updatedAt && (
              <span style={{ fontSize: 14, color: colors.subtext }}>
                Updated {updatedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}