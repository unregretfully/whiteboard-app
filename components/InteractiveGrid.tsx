"use client";

import { useEffect, useRef } from "react";

// The moving plus-sign background. It must sit directly inside the page's
// scrolling container, so it can match that container's width and stop at
// the scrollbar. With fadeOnScroll it fades out as you scroll down.
export function InteractiveGrid({
  gridColor,
  highlightColor,
  fadeOnScroll = false,
}: {
  gridColor: string;
  highlightColor: string;
  fadeOnScroll?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetMouse = useRef({ x: -1000, y: -1000 });
  const displayMouse = useRef({ x: -1000, y: -1000 });
  const ripples = useRef<{ x: number; y: number; time: number }[]>([]);
  const fade = useRef(1);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scroller = canvas.parentElement;

    function resize() {
      if (!canvas) return;
      const width = scroller ? scroller.clientWidth : window.innerWidth;
      canvas.width = width;
      canvas.height = window.innerHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    window.addEventListener("resize", resize);
    const observer = scroller ? new ResizeObserver(resize) : null;
    if (scroller && observer) observer.observe(scroller);

    function handleMouseMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      targetMouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    window.addEventListener("mousemove", handleMouseMove);

    function handleClick(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      ripples.current.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        time: performance.now(),
      });
      if (ripples.current.length > 6) ripples.current.shift();
    }
    window.addEventListener("click", handleClick, true);

    function handleScroll() {
      if (!scroller) return;
      fade.current = Math.max(0, 1 - scroller.scrollTop / (window.innerHeight * 0.7));
    }
    if (fadeOnScroll && scroller) {
      scroller.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
    }

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
    let lastOpacity = -1;

    function draw(now: number) {
      if (!canvas || !ctx) return;

      if (fade.current !== lastOpacity) {
        canvas.style.opacity = String(fade.current);
        lastOpacity = fade.current;
      }

      // Fully faded out: skip the drawing work entirely
      if (fade.current < 0.01) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

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
              const rippleFade = Math.max(0, 1 - age / RIPPLE_DURATION);
              strength = Math.max(strength, ringStrength * rippleFade);
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
      if (fadeOnScroll && scroller) scroller.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [gridColor, highlightColor, fadeOnScroll]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}