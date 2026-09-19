"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mediaQuery.matches);
    function handleChange(e: MediaQueryListEvent) {
      setIsDark(e.matches);
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    grid: isDark ? "#2a2a2a" : "#eeeeee",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#999999" : "#666666",
    buttonBg: isDark ? "#e5e5e5" : "#2c2c2c",
    buttonText: isDark ? "#111111" : "#ffffff",
    disabledBorder: isDark ? "#333333" : "#dddddd",
  };

  function getGridBackgroundImage(color: string) {
    const tileSize = 60;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tileSize}' height='${tileSize}'><line x1='${tileSize / 2 - 4}' y1='${tileSize / 2}' x2='${tileSize / 2 + 4}' y2='${tileSize / 2}' stroke='${color}' stroke-width='1'/><line x1='${tileSize / 2}' y1='${tileSize / 2 - 4}' x2='${tileSize / 2}' y2='${tileSize / 2 + 4}' stroke='${color}' stroke-width='1'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  async function handleNewPage() {
    setCreating(true);
    const { data, error } = await supabase.from("boards").insert({}).select().single();
    if (error) {
      console.error("Failed to create board:", error);
      setCreating(false);
      return;
    }
    if (data) {
      router.push(`/b/${data.id}`);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: colors.background,
        backgroundImage: getGridBackgroundImage(colors.grid),
        backgroundSize: "60px 60px",
        animation: "gridDrift 25s linear infinite",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 32px",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
          Notebooook
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <NavButton label="Log in" colors={colors} />
          <NavButton label="Sign up" colors={colors} filled />
        </div>
      </nav>

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "40px 20px",
        }}
      >
        <h1 style={{ fontSize: 40, fontWeight: 700, color: colors.text, margin: 0 }}>
          Put anything, anywhere.
        </h1>
        <p style={{ fontSize: 16, color: colors.subtext, marginTop: 12, maxWidth: 420 }}>
          A clean, infinite canvas for notes, ideas, and anything in between.
        </p>

        <button
          onClick={handleNewPage}
          disabled={creating}
          style={{
            marginTop: 32,
            padding: "14px 32px",
            fontSize: 16,
            fontWeight: 600,
            border: "none",
            borderRadius: 10,
            background: colors.buttonBg,
            color: colors.buttonText,
            cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? "Creating..." : "New Page"}
        </button>
      </div>

      {/* Explainer */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 48,
          flexWrap: "wrap",
          padding: "40px 20px 60px",
        }}
      >
        <Feature title="Write" desc="Put text anywhere on an endless canvas." colors={colors} />
        <Feature title="Organize" desc="Shapes and lines to map out ideas." colors={colors} />
        <Feature title="Share" desc="One link, always up to date." colors={colors} />
      </div>
    </div>
  );
}

function NavButton({
  label,
  colors,
  filled,
}: {
  label: string;
  colors: any;
  filled?: boolean;
}) {
  return (
    <button
      disabled
      title="Coming soon"
      style={{
        padding: "8px 18px",
        fontSize: 14,
        fontWeight: 500,
        borderRadius: 8,
        cursor: "not-allowed",
        border: filled ? "none" : `1px solid ${colors.disabledBorder}`,
        background: filled ? colors.buttonBg : "transparent",
        color: filled ? colors.buttonText : colors.text,
        opacity: 0.5,
      }}
    >
      {label}
    </button>
  );
}

function Feature({ title, desc, colors }: { title: string; desc: string; colors: any }) {
  return (
    <div style={{ maxWidth: 200, textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: colors.subtext }}>{desc}</div>
    </div>
  );
}