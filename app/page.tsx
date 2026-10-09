"use client";

import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/useUser";

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
    body: "Every page has its own link. Send it to someone and they see exactly what you see.",
  },
];

export default function Home() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
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
    grid: isDark ? "#2a2a2a" : "#eaeaea",
    gridHighlight: isDark ? "#8f8f8f" : "#6f6f6f",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#a3a3a3" : "#666666",
    buttonBg: isDark ? "#e5e5e5" : "#2c2c2c",
    buttonText: isDark ? "#111111" : "#ffffff",
    border: isDark ? "#2a2a2a" : "#ececec",
    outlineBorder: isDark ? "#333333" : "#dddddd",
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

  function navButtonStyle(filled?: boolean): CSSProperties {
    return {
      display: "inline-block",
      padding: "8px 18px",
      fontSize: 14,
      fontWeight: 500,
      fontFamily: "inherit",
      borderRadius: 8,
      cursor: "pointer",
      textDecoration: "none",
      border: filled ? "none" : `1px solid ${colors.outlineBorder}`,
      background: filled ? colors.buttonBg : "transparent",
      color: filled ? colors.buttonText : colors.text,
    };
  }

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
      <InteractiveGrid gridColor={colors.grid} highlightColor={colors.gridHighlight} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 28px",
            background: colors.background,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <img
            src="/logo.png"
            alt="Notebooook"
            style={{ height: 26, filter: isDark ? "invert(1)" : "none" }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!userLoading &&
              (user ? (
                <>
                  <Link href="/my" style={navButtonStyle()}>
                    My pages
                  </Link>
                  <span style={{ fontSize: 14, fontWeight: 500, color: colors.text, margin: "0 6px" }}>
                    {profile?.username ?? ""}
                  </span>
                  <button onClick={handleLogout} style={navButtonStyle()}>
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" style={navButtonStyle()}>
                    Log in
                  </Link>
                  <Link href="/signup" style={navButtonStyle(true)}>
                    Sign up
                  </Link>
                </>
              ))}
          </div>
        </nav>

        <section
          style={{
            minHeight: "calc(100vh - 140px)",
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

          <button
            onClick={handleNewPage}
            disabled={creating}
            style={{
              marginTop: 32,
              padding: "14px 32px",
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "inherit",
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
        </section>

        <section style={{ display: "flex", justifyContent: "center", padding: "24px 24px 120px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
              maxWidth: 960,
              width: "100%",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 14,
                  padding: 24,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.5, color: colors.subtext }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function InteractiveGrid({ gridColor, highlightColor }: { gridColor: string; highlightColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetMouse = useRef({ x: -1000, y: -1000 });
  const displayMouse = useRef({ x: -1000, y: -1000 });
  const ripples = useRef<{ x: number; y: number; time: number }[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function handleMouseMove(e: MouseEvent) {
      targetMouse.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("mousemove", handleMouseMove);

    function handleClick(e: MouseEvent) {
      ripples.current.push({ x: e.clientX, y: e.clientY, time: performance.now() });
      if (ripples.current.length > 6) ripples.current.shift();
    }
    window.addEventListener("click", handleClick, true);

    const GRID_SIZE = 60;
    const BASE_SIZE = 4;
    const MAX_SIZE = 12;
    const INFLUENCE_RADIUS = 320;
    const DRIFT_SPEED = 6;

    const RIPPLE_MAX_SIZE = 13;
    const RIPPLE_SPEED = 600;
    const RIPPLE_BAND = 90;
    const RIPPLE_DURATION = 1300;

    const startTime = performance.now();

    function draw(now: number) {
      if (!canvas || !ctx) return;

      displayMouse.current.x += (targetMouse.current.x - displayMouse.current.x) * 0.15;
      displayMouse.current.y += (targetMouse.current.y - displayMouse.current.y) * 0.15;
      const { x: mx, y: my } = displayMouse.current;

      ripples.current = ripples.current.filter((r) => now - r.time < RIPPLE_DURATION);

      const elapsedSeconds = (now - startTime) / 1000;
      const drift = ((elapsedSeconds * DRIFT_SPEED) % GRID_SIZE + GRID_SIZE) % GRID_SIZE;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cols = Math.ceil(canvas.width / GRID_SIZE) + 2;
      const rows = Math.ceil(canvas.height / GRID_SIZE) + 2;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * GRID_SIZE + drift;
          const y = j * GRID_SIZE + drift;
          const mouseDist = Math.hypot(x - mx, y - my);
          const mouseT = Math.max(0, 1 - mouseDist / INFLUENCE_RADIUS);
          const size = BASE_SIZE + (MAX_SIZE - BASE_SIZE) * mouseT;

          ctx.moveTo(x - size, y);
          ctx.lineTo(x + size, y);
          ctx.moveTo(x, y - size);
          ctx.lineTo(x, y + size);
        }
      }
      ctx.stroke();

      if (ripples.current.length > 0) {
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = 1.5;

        for (let i = -1; i < cols; i++) {
          for (let j = -1; j < rows; j++) {
            const x = i * GRID_SIZE + drift;
            const y = j * GRID_SIZE + drift;

            let strength = 0;
            for (const ripple of ripples.current) {
              const age = now - ripple.time;
              const ringRadius = (age / 1000) * RIPPLE_SPEED;
              const pointDist = Math.hypot(x - ripple.x, y - ripple.y);
              const distFromRing = Math.abs(pointDist - ringRadius);
              const ringStrength = Math.max(0, 1 - distFromRing / RIPPLE_BAND);
              const fade = Math.max(0, 1 - age / RIPPLE_DURATION);
              strength = Math.max(strength, ringStrength * fade);
            }

            if (strength < 0.02) continue;

            const size = BASE_SIZE + (RIPPLE_MAX_SIZE - BASE_SIZE) * strength;
            ctx.globalAlpha = strength;
            ctx.beginPath();
            ctx.moveTo(x - size, y);
            ctx.lineTo(x + size, y);
            ctx.moveTo(x, y - size);
            ctx.lineTo(x, y + size);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [gridColor, highlightColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}