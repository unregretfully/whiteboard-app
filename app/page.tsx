"use client";

import { useState, useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, User, LayoutGrid, Palette, Settings, LogOut } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/useUser";
import { Dropdown, MenuItem, MenuDivider } from "../components/Dropdown";
import { InteractiveGrid } from "../components/InteractiveGrid";

const FEATURES = [
  {
    title: "Write",
    body: "Click anywhere and start typing. Bullets continue on their own, and Ctrl+Enter starts a new note right underneath.",
  },
  {
    title: "Organize",
    body: "Drag notes where you want them, connect ideas with boxes and lines, and zoom out to see the whole page.",
  },
  {
    title: "Share",
    body: "Every page has its own link. Keep it private, or send it so others can see exactly what you see.",
  },
];

export default function Home() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const [isDark, setIsDark] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showFounding, setShowFounding] = useState(false);

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
    document.title = "NoteBooook";
    // Display only. The database decides who actually becomes a founder.
    setShowFounding(Date.now() < new Date("2026-10-13T00:00:00-07:00").getTime());
  }, []);

  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    grid: isDark ? "#2a2a2a" : "#eaeaea",
    gridHighlight: isDark ? "#8f8f8f" : "#6f6f6f",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#a3a3a3" : "#666666",
    border: isDark ? "#2a2a2a" : "#ececec",
    cardBg: isDark ? "#161616" : "#fafafa",
    hover: isDark ? "#262626" : "#f0f0f0",
    menuBg: isDark ? "#1a1a1a" : "#ffffff",
  };

  const menuColors = {
    hoverBg: colors.hover,
    textColor: colors.text,
    mutedColor: colors.subtext,
    borderColor: colors.border,
  };

  async function handleNewPage() {
    setCreating(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("boards").insert({ id });
    if (error) {
      console.error("Failed to create page:", error);
      setCreating(false);
      return;
    }
    router.push(`/b/${id}`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const navButtonStyle: CSSProperties = {
    display: "inline-block",
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "inherit",
    borderRadius: 8,
    textDecoration: "none",
  };

  const headingStyle: CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    color: colors.text,
    margin: "0 0 16px",
  };
  const paragraphStyle: CSSProperties = {
    fontSize: 16,
    lineHeight: 1.65,
    color: colors.subtext,
    margin: "0 0 14px",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: colors.background,
        fontFamily: "var(--font-funnel-sans), Arial, sans-serif",
      }}
    >
      <InteractiveGrid gridColor={colors.grid} highlightColor={colors.gridHighlight} fadeOnScroll />

      <div style={{ position: "relative", zIndex: 1 }}>
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            height: 60,
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 28px",
            background: colors.background,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <img
            src="/logo.png"
            alt="NoteBooook"
            style={{ height: 26, filter: isDark ? "invert(1)" : "none" }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!userLoading &&
              (user ? (
                <>
                  <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>
                    {profile?.username ?? ""}
                  </span>
                  <Dropdown
                    align="right"
                    width={220}
                    bg={colors.menuBg}
                    border={colors.border}
                    openOnHover
                    trigger={({ toggle }) => (
                      <button
                        onClick={toggle}
                        aria-label="Menu"
                        className="nb-btn"
                        style={{
                          width: 38,
                          height: 38,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 10,
                        }}
                      >
                        <Menu size={18} strokeWidth={2} />
                      </button>
                    )}
                  >
                    {({ close }) => (
                      <>
                        <MenuItem {...menuColors} icon={<User size={16} />} label="Profile" soon />
                        <MenuItem
                          {...menuColors}
                          icon={<LayoutGrid size={16} />}
                          label="My pages"
                          href="/my"
                          onClick={close}
                        />
                        <MenuItem {...menuColors} icon={<Palette size={16} />} label="Appearance" soon />
                        <MenuItem {...menuColors} icon={<Settings size={16} />} label="Settings" soon />
                        <MenuDivider color={colors.border} />
                        <MenuItem
                          {...menuColors}
                          icon={<LogOut size={16} />}
                          label="Log out"
                          onClick={async () => {
                            close();
                            await handleLogout();
                          }}
                        />
                      </>
                    )}
                  </Dropdown>
                </>
              ) : (
                <>
                  <Link href="/login" className="nb-btn" style={navButtonStyle}>
                    Log in
                  </Link>
                  <Link href="/signup" className="nb-btn-solid" style={navButtonStyle}>
                    Sign up
                  </Link>
                </>
              ))}
          </div>
        </nav>

        {/* Hero: exactly one screen tall, so everything below needs a scroll */}
        <section
          style={{
            minHeight: "calc(100vh - 60px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "40px 20px 80px",
          }}
        >
          <h1 style={{ fontSize: 40, fontWeight: 700, color: colors.text, margin: 0 }}>
            Put anything, anywhere.
          </h1>

          <button
            onClick={handleNewPage}
            disabled={creating}
            className="nb-btn-solid"
            style={{
              marginTop: 32,
              padding: "14px 32px",
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "inherit",
              borderRadius: 10,
            }}
          >
            {creating ? "Creating..." : "New Page"}
          </button>
        </section>

        <section style={{ display: "flex", justifyContent: "center", padding: "40px 24px 100px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
              maxWidth: 960,
              width: "100%",
            }}
          >
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 110}>
                <div
                  style={{
                    height: "100%",
                    boxSizing: "border-box",
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: 28,
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, color: colors.text, marginBottom: 10 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.55, color: colors.subtext }}>{f.body}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section style={{ display: "flex", justifyContent: "center", padding: "0 24px 120px" }}>
          <Reveal>
            <div style={{ maxWidth: 680 }}>
              <h2 style={headingStyle}>About NoteBooook</h2>
              <p style={paragraphStyle}>
                NoteBooook is an infinite canvas for notes, ideas, and anything in between. It's an
                independent product: free to use, with an optional paid plan, NB+, for extra features.
              </p>
              <p style={paragraphStyle}>
                Built and run by <strong style={{ color: colors.text }}>Henry H.</strong>, a solo founder,
                one feature at a time, based on what people actually use.
              </p>
              {showFounding && (
                <div
                  style={{
                    marginTop: 20,
                    padding: "14px 18px",
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: colors.text,
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                  }}
                >
                  <strong>Founding members:</strong> sign up by October 12 and NB+ is free for life.
                </div>
              )}
            </div>
          </Reveal>
        </section>

        <footer
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "24px 28px",
            fontSize: 13,
            color: colors.subtext,
            background: colors.background,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <span>NoteBooook</span>
          <Link href="/stats" style={{ color: colors.subtext, textDecoration: "none" }}>
            Stats
          </Link>
        </footer>
      </div>
    </div>
  );
}

// Fades and slides its content in the first time it scrolls into view
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        height: "100%",
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(18px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}