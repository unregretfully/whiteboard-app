"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Reusable dropdown: you supply the trigger button and the panel content.
// It fades and slides in/out, closes on outside click or Escape.
export function Dropdown({
  trigger,
  children,
  align = "left",
  width = 260,
  bg,
  border,
}: {
  trigger: (api: { open: boolean; toggle: () => void }) => ReactNode;
  children: (api: { close: () => void }) => ReactNode;
  align?: "left" | "right";
  width?: number;
  bg: string;
  border: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <div
        role="menu"
        aria-hidden={!open}
        style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          [align]: 0,
          width,
          zIndex: 30,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: 6,
          boxShadow: "0 8px 30px rgba(0,0,0,0.16)",
          transformOrigin: align === "left" ? "top left" : "top right",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0) scale(1)" : "translateY(-6px) scale(0.97)",
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
          transition: open
            ? "opacity 0.16s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s"
            : "opacity 0.12s ease, transform 0.12s ease, visibility 0s linear 0.12s",
        }}
      >
        {children({ close: () => setOpen(false) })}
      </div>
    </div>
  );
}