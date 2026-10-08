"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/useUser";

type BoardRow = {
  id: string;
  name: string | null;
  data: any[] | null;
  created_at: string;
  updated_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyPages() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const [isDark, setIsDark] = useState(false);
  const [boards, setBoards] = useState<BoardRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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
    document.title = "My pages – Notebooook";
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("boards")
      .select("id, name, data, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Load pages failed:", error);
        setBoards((data as BoardRow[]) ?? []);
      });
  }, [user]);

  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#a3a3a3" : "#666666",
    border: isDark ? "#2a2a2a" : "#ececec",
    cardBg: isDark ? "#1a1a1a" : "#ffffff",
    thumbBg: isDark ? "#151515" : "#f7f7f7",
    buttonBg: isDark ? "#e5e5e5" : "#2c2c2c",
    buttonText: isDark ? "#111111" : "#ffffff",
    outlineBorder: isDark ? "#333333" : "#dddddd",
    danger: isDark ? "#f87171" : "#dc2626",
  };

  const pillButton = (filled?: boolean): CSSProperties => ({
    display: "inline-block",
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "inherit",
    borderRadius: 8,
    cursor: "pointer",
    textDecoration: "none",
    border: filled ? "none" : `1px solid ${colors.outlineBorder}`,
    background: filled ? colors.buttonBg : "transparent",
    color: filled ? colors.buttonText : colors.text,
  });

  const smallLink: CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 13,
    fontFamily: "inherit",
    color: colors.subtext,
    cursor: "pointer",
    textDecoration: "none",
  };

  async function createPage() {
    setCreating(true);
    const { data, error } = await supabase.from("boards").insert({}).select().single();
    if (error || !data) {
      console.error("Failed to create page:", error);
      setCreating(false);
      return;
    }
    router.push(`/b/${data.id}`);
  }

  async function saveRename(id: string) {
    const name = renameValue.trim() || null;
    const { error } = await supabase
      .from("boards")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("Rename failed:", error);
      return;
    }
    setBoards((prev) => prev?.map((b) => (b.id === id ? { ...b, name } : b)) ?? prev);
    setRenamingId(null);
  }

  async function deletePage(id: string) {
    if (!window.confirm("Delete this page? This can't be undone.")) return;
    const { error } = await supabase.from("boards").delete().eq("id", id);
    if (error) {
      console.error("Delete failed:", error);
      return;
    }
    setBoards((prev) => prev?.filter((b) => b.id !== id) ?? prev);
  }

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
          justifyContent: "space-between",
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
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>
              {profile?.username ?? ""}
            </span>
            <button onClick={createPage} disabled={creating} style={pillButton(true)}>
              {creating ? "Creating..." : "New page"}
            </button>
          </div>
        )}
      </nav>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: colors.text, margin: "0 0 24px" }}>
          My pages
        </h1>

        {userLoading ? null : !user ? (
          <div>
            <p style={{ color: colors.subtext, fontSize: 15, marginBottom: 16 }}>
              Log in to see your pages.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/login?next=/my" style={pillButton()}>
                Log in
              </Link>
              <Link href="/signup?next=/my" style={pillButton(true)}>
                Sign up
              </Link>
            </div>
          </div>
        ) : boards === null ? (
          <p style={{ color: colors.subtext, fontSize: 15 }}>Loading...</p>
        ) : boards.length === 0 ? (
          <p style={{ color: colors.subtext, fontSize: 15 }}>
            No pages yet. Click "New page" to make one, or claim a page you started earlier.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 20,
            }}
          >
            {boards.map((b) => (
              <div
                key={b.id}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: colors.cardBg,
                }}
              >
                <Link
                  href={`/b/${b.id}`}
                  style={{
                    display: "block",
                    height: 150,
                    background: colors.thumbBg,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <BoardThumb data={b.data ?? []} color={colors.text} />
                </Link>

                <div style={{ padding: 14 }}>
                  {renamingId === b.id ? (
                    <>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(b.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "6px 8px",
                          fontSize: 15,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          color: colors.text,
                          background: colors.cardBg,
                          border: `1px solid ${colors.outlineBorder}`,
                          borderRadius: 8,
                          outline: "none",
                        }}
                      />
                      <div style={{ fontSize: 12, color: colors.subtext, marginTop: 4 }}>
                        Enter to save, Esc to cancel
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: colors.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {b.name?.trim() || "Untitled"}
                      </div>
                      <div style={{ fontSize: 12, color: colors.subtext, marginTop: 4 }}>
                        Edited {formatDate(b.updated_at)} · Created {formatDate(b.created_at)}
                      </div>
                    </>
                  )}

                  <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
                    <Link
                      href={`/b/${b.id}`}
                      style={{ ...smallLink, color: colors.text, fontWeight: 600 }}
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => {
                        setRenamingId(b.id);
                        setRenameValue(b.name ?? "");
                      }}
                      style={smallLink}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => deletePage(b.id)}
                      style={{ ...smallLink, color: colors.danger }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Draws a rough miniature of a page from its saved objects (approximate on purpose).
function BoardThumb({ data, color }: { data: any[]; color: string }) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const parts: React.ReactNode[] = [];

  function grow(x1: number, y1: number, x2: number, y2: number) {
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  }

  data.forEach((o, i) => {
    if (!o) return;

    if (o.type === "text") {
      const size = Number(o.fontSize) || 20;
      const maxW = Number(o.wrapWidth) || Infinity;
      String(o.text ?? "")
        .split("\n")
        .forEach((line, k) => {
          const w = Math.max(4, Math.min(maxW, line.length * size * 0.55));
          const y = o.y + k * size * 1.2 + size * 0.25;
          grow(o.x, y, o.x + w, y + size * 0.55);
          parts.push(
            <rect
              key={`${i}-${k}`}
              x={o.x}
              y={y}
              width={w}
              height={size * 0.55}
              rx={size * 0.2}
              fill={color}
              opacity={0.65}
            />
          );
        });
    } else if (o.type === "shape") {
      grow(o.x, o.y, o.x + o.width, o.y + o.height);
      parts.push(
        <rect
          key={i}
          x={o.x}
          y={o.y}
          width={o.width}
          height={o.height}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          opacity={0.65}
        />
      );
    } else if (o.type === "line") {
      grow(o.x1, o.y1, o.x2, o.y2);
      parts.push(
        <line
          key={i}
          x1={o.x1}
          y1={o.y1}
          x2={o.x2}
          y2={o.y2}
          stroke={color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          opacity={0.65}
        />
      );
    }
  });

  if (parts.length === 0 || !isFinite(minX)) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          opacity: 0.5,
          color,
        }}
      >
        Empty
      </div>
    );
  }

  const pad = Math.max(maxX - minX, maxY - minY) * 0.1 + 10;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {parts}
    </svg>
  );
}