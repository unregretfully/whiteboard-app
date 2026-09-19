"use client";

import { useState, useEffect, useRef } from "react";
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
    grid: isDark ? "#2a2a2a" : "#eaeaea",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#999999" : "#666666",
    buttonBg: isDark ? "#e5e5e5" : "#2c2c2c",
    buttonText: isDark ? "#111111" : "#ffffff",
    disabledBorder: isDark ? "#333333" : "#dddddd",
    navBarBorder: isDark ? "#2a2a2a" : "#ececec",
  };

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
        position: "relative",
        minHeight: "100vh",
        backgroundColor: colors.background,
        overflow: "hidden",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <InteractiveGrid gridColor={colors.grid} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <nav
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 28px",
            background: colors.background,
            borderBottom: `1px solid ${colors.navBarBorder}`,
            width: "100%",
          }}
        >
          <img
            src="/logo.png"
            alt="Notebooook"
            style={{ height: 26, filter: isDark ? "invert(1)" : "none" }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <NavButton label="Log in" colors={colors} />
            <NavButton label="Sign up" colors={colors} filled />
          </div>
        </nav>

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

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 56,
            flexWrap: "wrap",
            padding: "40px 20px 60px",
          }}
        >
          {["Write", "Organize", "Share"].map((label) => (
            <div key={label} style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InteractiveGrid({ gridColor }: { gridColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetMouse = useRef({ x: -1000, y: -1000 });
  const displayMouse = useRef({ x: -1000, y: -1000 });
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

    const GRID_SIZE = 60;
    const BASE_SIZE = 4;
    const MAX_SIZE = 12;
    const INFLUENCE_RADIUS = 320;
    const DRIFT_SPEED = 6;

    const startTime = performance.now();

    function draw(now: number) {
      if (!canvas || !ctx) return;

      displayMouse.current.x += (targetMouse.current.x - displayMouse.current.x) * 0.15;
      displayMouse.current.y += (targetMouse.current.y - displayMouse.current.y) * 0.15;
      const { x: mx, y: my } = displayMouse.current;

      const elapsedSeconds = (now - startTime) / 1000;
      const drift = ((elapsedSeconds * DRIFT_SPEED) % GRID_SIZE + GRID_SIZE) % GRID_SIZE;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      const cols = Math.ceil(canvas.width / GRID_SIZE) + 2;
      const rows = Math.ceil(canvas.height / GRID_SIZE) + 2;

      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * GRID_SIZE + drift;
          const y = j * GRID_SIZE + drift;
          const dist = Math.hypot(x - mx, y - my);
          const t = Math.max(0, 1 - dist / INFLUENCE_RADIUS);
          const size = BASE_SIZE + (MAX_SIZE - BASE_SIZE) * t;

          ctx.beginPath();
          ctx.moveTo(x - size, y);
          ctx.lineTo(x + size, y);
          ctx.moveTo(x, y - size);
          ctx.lineTo(x, y + size);
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [gridColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}

function NavButton({ label, colors, filled }: { label: string; colors: any; filled?: boolean }) {
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