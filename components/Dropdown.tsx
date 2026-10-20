"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

// Reusable dropdown: you supply the trigger button and the panel content.
// Fades and slides in/out; closes on outside click or Escape.
// With openOnHover it also opens when the mouse is over it.
export function Dropdown({
  trigger,
  children,
  align = "left",
  width = 260,
  bg,
  border,
  openOnHover = false,
}: {
  trigger: (api: { open: boolean; toggle: () => void }) => ReactNode;
  children: (api: { close: () => void }) => ReactNode;
  align?: "left" | "right";
  width?: number;
  bg: string;
  border: string;
  openOnHover?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

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
    <div
      ref={ref}
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={
        openOnHover
          ? () => {
              clearCloseTimer();
              setOpen(true);
            }
          : undefined
      }
      onMouseLeave={
        openOnHover
          ? () => {
              clearCloseTimer();
              closeTimer.current = setTimeout(() => setOpen(false), 180);
            }
          : undefined
      }
    >
      {trigger({
        open,
        // In hover mode a click only opens, so tapping on touch screens works
        toggle: () => (openOnHover ? setOpen(true) : setOpen((o) => !o)),
      })}
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

export function MenuItem({
  icon,
  label,
  onClick,
  href,
  soon,
  hoverBg,
  textColor,
  mutedColor,
  borderColor,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  soon?: boolean;
  hoverBg: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
}) {
  const [hover, setHover] = useState(false);

  const base: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    border: "none",
    borderRadius: 8,
    textAlign: "left",
    textDecoration: "none",
    fontFamily: "var(--font-funnel-sans), Arial, sans-serif",
    fontSize: 14,
    fontWeight: 500,
    color: textColor,
    background: hover && !soon ? hoverBg : "transparent",
    cursor: soon ? "default" : "pointer",
    opacity: soon ? 0.55 : 1,
    transition: "background 0.12s ease",
  };

  const content = (
    <>
      <span style={{ display: "flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {soon && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: 6,
            border: `1px solid ${borderColor}`,
            color: mutedColor,
          }}
        >
          SOON
        </span>
      )}
    </>
  );

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };

  if (soon) {
    return (
      <div title="Coming soon" style={base} {...handlers}>
        {content}
      </div>
    );
  }
  if (href) {
    return (
      <Link href={href} onClick={onClick} style={base} {...handlers}>
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} style={base} {...handlers}>
      {content}
    </button>
  );
}

export function MenuDivider({ color }: { color: string }) {
  return <div style={{ height: 1, background: color, margin: "6px 4px" }} />;
}