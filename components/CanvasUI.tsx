"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode, MutableRefObject } from "react";
import Link from "next/link";
import { Rect } from "react-konva";
import {
  MousePointer2,
  Eye,
  Type,
  Square,
  Slash,
  House,
  Save,
  Share2,
  Check,
  Lock,
  Pencil,
  Link2,
} from "lucide-react";
import { Dropdown } from "./Dropdown";
import type { TextObj, CanvasObject, Mode, Access } from "./canvasTypes";

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 130;
const FONT = "var(--font-funnel-sans), Arial, sans-serif";

/* ---------- Page name box (top center) ---------- */

export function PageNameInput({
  pageName,
  setPageName,
  readOnly,
  colors,
  onFocusChange,
}: {
  pageName: string | null;
  setPageName: (name: string) => void;
  readOnly: boolean;
  colors: any;
  onFocusChange: (focused: boolean) => void;
}) {
  return (
    <input
      value={pageName ?? ""}
      onChange={(e) => setPageName(e.target.value)}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      readOnly={readOnly}
      maxLength={100}
      placeholder="Untitled"
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        textAlign: "center",
        fontSize: 14,
        fontWeight: 500,
        fontFamily: FONT,
        color: colors.text,
        background: colors.toolbarBg,
        border: `1px solid ${colors.toolbarBorder}`,
        borderRadius: 10,
        padding: "9px 16px",
        outline: "none",
        minWidth: 160,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    />
  );
}

/* ---------- Text wrap-width handle ---------- */

export function WrapHandle({
  obj,
  shapeRefs,
  wrapHandleRefs,
  trRef,
  commitChange,
  objects,
  colors,
}: {
  obj: TextObj;
  shapeRefs: MutableRefObject<Record<string, any>>;
  wrapHandleRefs: MutableRefObject<Record<string, any>>;
  trRef: MutableRefObject<any>;
  commitChange: (newState: CanvasObject[]) => void;
  objects: CanvasObject[];
  colors: any;
}) {
  const currentWidth = obj.wrapWidth ?? 100;
  const currentHeight = obj.fontSize * 1.2 * Math.max(1, obj.text.split("\n").length);

  return (
    <Rect
      x={obj.x + currentWidth - 3}
      y={obj.y + currentHeight / 2 - 10}
      width={6}
      height={20}
      cornerRadius={3}
      fill={colors.toolbarActiveBg}
      stroke={colors.transformerStroke}
      strokeWidth={1.5}
      draggable
      ref={(node) => {
        if (node) wrapHandleRefs.current[obj.id] = node;
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
      }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        const liveTextNode = shapeRefs.current[obj.id];
        if (!liveTextNode) return;

        const liveX = liveTextNode.x();
        const minWidth = Math.max(20, obj.fontSize);
        const newWidth = Math.max(minWidth, e.target.x() - liveX + 3);
        liveTextNode.width(newWidth);

        const correctedX = liveX + newWidth - 3;
        const correctedY = liveTextNode.y() + liveTextNode.height() / 2 - 10;
        e.target.position({ x: correctedX, y: correctedY });

        trRef.current?.forceUpdate();
        liveTextNode.getLayer()?.batchDraw();
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        const liveTextNode = shapeRefs.current[obj.id];
        const liveX = liveTextNode ? liveTextNode.x() : obj.x;
        const minWidth = Math.max(20, obj.fontSize);
        const newWidth = Math.max(minWidth, e.target.x() - liveX + 3);
        commitChange(
          objects.map((o) => (o.id === obj.id && o.type === "text" ? { ...o, wrapWidth: newWidth } : o))
        );
      }}
    />
  );
}

/* ---------- Left toolbar (vertical, centered) ---------- */

export function Toolbar({
  mode,
  onSelect,
  readOnly,
  colors,
}: {
  mode: Mode;
  onSelect: (m: Mode) => void;
  readOnly: boolean;
  colors: any;
}) {
  const tools: { mode: Mode; label: string; Icon: any }[] = [
    { mode: "view", label: "View (V)", Icon: Eye },
    { mode: "select", label: "Select (S)", Icon: MousePointer2 },
    { mode: "text", label: "Text (T)", Icon: Type },
    { mode: "line", label: "Line (L)", Icon: Slash },
    { mode: "shape", label: "Rectangle (R)", Icon: Square },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        background: colors.toolbarBg,
        border: `1px solid ${colors.toolbarBorder}`,
        borderRadius: 12,
        padding: 4,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      {tools.map(({ mode: m, label, Icon }) => {
        const active = mode === m;
        const disabled = readOnly && m !== "view";
        return (
          <button
            key={m}
            title={disabled ? `${label} (view only)` : label}
            onClick={() => {
              if (!disabled) onSelect(m);
            }}
            style={{
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 8,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.35 : 1,
              background: active ? colors.toolbarActiveBg : "transparent",
              color: active ? "#ffffff" : colors.text,
              transition: "background 0.12s ease",
            }}
            onMouseEnter={(e) => {
              if (!active && !disabled) e.currentTarget.style.background = colors.toolbarHoverBg;
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon size={18} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Top-left bar: home, save, share ---------- */

function BarButton({
  title,
  onClick,
  href,
  disabled,
  active,
  colors,
  children,
}: {
  title: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  active?: boolean;
  colors: any;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const style: CSSProperties = {
    width: 38,
    height: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    background: active || (hover && !disabled) ? colors.toolbarHoverBg : "transparent",
    color: colors.text,
    opacity: disabled ? 0.4 : 1,
    transition: "background 0.12s ease",
    textDecoration: "none",
  };
  const hoverHandlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };

  if (href) {
    return (
      <Link href={href} title={title} style={style} {...hoverHandlers}>
        {children}
      </Link>
    );
  }
  return (
    <button title={title} onClick={disabled ? undefined : onClick} style={style} {...hoverHandlers}>
      {children}
    </button>
  );
}

export function PageBar({
  homeHref,
  canSave,
  saved,
  onSave,
  access,
  ownerId,
  userId,
  isPremium,
  onChangeAccess,
  colors,
}: {
  homeHref: string;
  canSave: boolean;
  saved: boolean;
  onSave: () => void;
  access: Access;
  ownerId: string | null;
  userId: string | null;
  isPremium: boolean;
  onChangeAccess: (next: Access) => Promise<string | null>;
  colors: any;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 20,
        display: "flex",
        gap: 2,
        background: colors.toolbarBg,
        border: `1px solid ${colors.toolbarBorder}`,
        borderRadius: 12,
        padding: 4,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      <BarButton title="Home" href={homeHref} colors={colors}>
        <House size={18} strokeWidth={2} />
      </BarButton>

      <BarButton
        title={canSave ? "Save (Ctrl+S)" : "View only"}
        onClick={onSave}
        disabled={!canSave}
        colors={colors}
      >
        {saved ? <Check size={18} strokeWidth={2.5} /> : <Save size={18} strokeWidth={2} />}
      </BarButton>

      <ShareMenu
        access={access}
        ownerId={ownerId}
        userId={userId}
        isPremium={isPremium}
        onChangeAccess={onChangeAccess}
        colors={colors}
      />
    </div>
  );
}

function ShareMenu({
  access,
  ownerId,
  userId,
  isPremium,
  onChangeAccess,
  colors,
}: {
  access: Access;
  ownerId: string | null;
  userId: string | null;
  isPremium: boolean;
  onChangeAccess: (next: Access) => Promise<string | null>;
  colors: any;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isOwner = ownerId !== null && ownerId === userId;

  async function pick(next: Access) {
    setMessage(await onChangeAccess(next));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage("Couldn't copy. Copy the address from your browser instead.");
    }
  }

  const options: { value: Access; icon: ReactNode; label: string; description: string; badge?: string }[] = [
    {
      value: "private",
      icon: <Lock size={16} strokeWidth={2} />,
      label: "Only me",
      description: "Only you can open this page.",
    },
    {
      value: "view",
      icon: <Eye size={16} strokeWidth={2} />,
      label: "Anyone with the link can view",
      description: "They can look, but not change anything.",
    },
    {
      value: "edit",
      icon: <Pencil size={16} strokeWidth={2} />,
      label: "Anyone with the link can edit",
      description: "Changes save for everyone. Best for taking turns.",
      badge: isPremium ? undefined : "NB+",
    },
  ];

  const noteStyle: CSSProperties = {
    fontSize: 12,
    lineHeight: 1.5,
    color: colors.subtext,
    margin: "4px 8px 8px",
  };

  return (
    <Dropdown
      align="left"
      width={330}
      bg={colors.toolbarBg}
      border={colors.toolbarBorder}
      trigger={({ open, toggle }) => (
        <BarButton title="Share" onClick={toggle} active={open} colors={colors}>
          <Share2 size={18} strokeWidth={2} />
        </BarButton>
      )}
    >
      {() => (
        <div style={{ fontFamily: FONT, color: colors.text }}>
          <div style={{ fontSize: 13, fontWeight: 600, padding: "6px 8px 4px" }}>Share page</div>

          {isOwner ? (
            options.map((o) => (
              <ShareOption
                key={o.value}
                icon={o.icon}
                label={o.label}
                description={o.description}
                badge={o.badge}
                selected={access === o.value}
                onClick={() => pick(o.value)}
                colors={colors}
              />
            ))
          ) : ownerId === null ? (
            <p style={noteStyle}>
              This page isn't saved to an account yet, so anyone with the link can edit it. Claim it to
              choose who can see it.
            </p>
          ) : (
            <p style={noteStyle}>Only the owner can change who can see this page.</p>
          )}

          {message && <p style={{ ...noteStyle, color: colors.text, fontWeight: 600 }}>{message}</p>}

          <button
            onClick={copyLink}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "calc(100% - 8px)",
              margin: "6px 4px 4px",
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              color: colors.text,
              background: "transparent",
              border: `1px solid ${colors.toolbarBorder}`,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={15} strokeWidth={2.5} /> : <Link2 size={15} strokeWidth={2} />}
            {copied ? "Link copied" : "Copy link"}
          </button>

          {isOwner && access === "private" && (
            <p style={{ ...noteStyle, marginTop: 4 }}>This link only opens for you right now.</p>
          )}
        </div>
      )}
    </Dropdown>
  );
}

function ShareOption({
  icon,
  label,
  description,
  badge,
  selected,
  onClick,
  colors,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  badge?: string;
  selected: boolean;
  onClick: () => void;
  colors: any;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: "10px 8px",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        color: colors.text,
        background: hover ? colors.toolbarHoverBg : "transparent",
        transition: "background 0.12s ease",
      }}
    >
      <span style={{ marginTop: 2, display: "flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
          {label}
          {badge && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 6,
                border: `1px solid ${colors.toolbarBorder}`,
                color: colors.subtext,
              }}
            >
              {badge}
            </span>
          )}
        </span>
        <span style={{ display: "block", fontSize: 12, color: colors.subtext, marginTop: 2 }}>
          {description}
        </span>
      </span>
      <span style={{ width: 16, display: "flex", marginTop: 2 }}>
        {selected && <Check size={16} strokeWidth={2.5} />}
      </span>
    </button>
  );
}

/* ---------- Minimap ---------- */

export function MiniMap({
  objects,
  stagePos,
  stageScale,
  dimensions,
  colors,
  onNavigate,
  active,
}: {
  objects: CanvasObject[];
  stagePos: { x: number; y: number };
  stageScale: number;
  dimensions: { width: number; height: number };
  colors: any;
  onNavigate: (worldX: number, worldY: number) => void;
  active: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  if (dimensions.width === 0) return null;

  const viewport = {
    left: -stagePos.x / stageScale,
    top: -stagePos.y / stageScale,
    right: (-stagePos.x + dimensions.width) / stageScale,
    bottom: (-stagePos.y + dimensions.height) / stageScale,
  };

  function boundsOf(obj: CanvasObject) {
    if (obj.type === "text") {
      return {
        left: obj.x,
        top: obj.y,
        right: obj.x + Math.max(60, obj.text.length * obj.fontSize * 0.55),
        bottom: obj.y + obj.fontSize * 1.4,
      };
    }
    if (obj.type === "shape") {
      return { left: obj.x, top: obj.y, right: obj.x + obj.width, bottom: obj.y + obj.height };
    }
    return {
      left: Math.min(obj.x1, obj.x2),
      top: Math.min(obj.y1, obj.y2),
      right: Math.max(obj.x1, obj.x2),
      bottom: Math.max(obj.y1, obj.y2),
    };
  }

  const objectBounds = objects.map(boundsOf);

  const allLefts = [viewport.left, ...objectBounds.map((b) => b.left)];
  const allTops = [viewport.top, ...objectBounds.map((b) => b.top)];
  const allRights = [viewport.right, ...objectBounds.map((b) => b.right)];
  const allBottoms = [viewport.bottom, ...objectBounds.map((b) => b.bottom)];

  const PADDING = 100;
  const boundsMinX = Math.min(...allLefts) - PADDING;
  const boundsMinY = Math.min(...allTops) - PADDING;
  const boundsMaxX = Math.max(...allRights) + PADDING;
  const boundsMaxY = Math.max(...allBottoms) + PADDING;

  const boundsWidth = Math.max(1, boundsMaxX - boundsMinX);
  const boundsHeight = Math.max(1, boundsMaxY - boundsMinY);

  const mapScale = Math.min(MINIMAP_WIDTH / boundsWidth, MINIMAP_HEIGHT / boundsHeight);
  const offsetX = (MINIMAP_WIDTH - boundsWidth * mapScale) / 2;
  const offsetY = (MINIMAP_HEIGHT - boundsHeight * mapScale) / 2;

  function toMapX(worldX: number) {
    return offsetX + (worldX - boundsMinX) * mapScale;
  }
  function toMapY(worldY: number) {
    return offsetY + (worldY - boundsMinY) * mapScale;
  }

  function handleMinimapClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = boundsMinX + (clickX - offsetX) / mapScale;
    const worldY = boundsMinY + (clickY - offsetY) / mapScale;
    onNavigate(worldX, worldY);
  }

  const isVisible = active || hovered;

  return (
    <div
      onClick={handleMinimapClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        background: colors.minimapBg,
        border: `1px solid ${colors.toolbarBorder}`,
        borderRadius: 8,
        cursor: "pointer",
        overflow: "hidden",
        zIndex: 10,
        opacity: isVisible ? 1 : 0.15,
        transform: isVisible ? "scale(1)" : "scale(0.92)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
      }}
    >
      {objectBounds.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: toMapX(b.left),
            top: toMapY(b.top),
            width: 4,
            height: 4,
            borderRadius: 2,
            background: colors.minimapDot,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: toMapX(viewport.left),
          top: toMapY(viewport.top),
          width: Math.max(2, (viewport.right - viewport.left) * mapScale),
          height: Math.max(2, (viewport.bottom - viewport.top) * mapScale),
          border: `1.5px solid ${colors.minimapViewport}`,
          borderRadius: 2,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

/* ---------- Bottom-left notice (claim / sign up / view only) ---------- */

export function BoardStatus({
  isLoaded,
  userLoading,
  ownerId,
  user,
  isReadOnly,
  boardId,
  onClaim,
  colors,
}: {
  isLoaded: boolean;
  userLoading: boolean;
  ownerId: string | null;
  user: { id: string } | null;
  isReadOnly: boolean;
  boardId: string;
  onClaim: () => void;
  colors: any;
}) {
  if (!isLoaded || userLoading) return null;

  let content: ReactNode = null;

  if (ownerId === null && user) {
    content = (
      <>
        <span>This page isn't saved to your account. Claiming makes it private.</span>
        <button
          onClick={onClaim}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            background: colors.toolbarActiveBg,
            color: "#ffffff",
          }}
        >
          Claim page
        </button>
      </>
    );
  } else if (ownerId === null) {
    content = (
      <>
        <span>Not saved. Pages without an account are deleted after 7 days without a visit.</span>
        <Link
          href={`/signup?next=${encodeURIComponent(`/b/${boardId}`)}`}
          style={{ color: colors.text, fontWeight: 600, textDecoration: "underline" }}
        >
          Sign up to keep it
        </Link>
      </>
    );
  } else if (isReadOnly) {
    content = <span>View only. This page belongs to someone else.</span>;
  } else if (ownerId !== user?.id) {
    content = <span>Shared page. Anyone with the link can edit it.</span>;
  }

  if (!content) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        zIndex: 10,
        maxWidth: "min(480px, calc(100vw - 240px))",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "6px 12px",
        background: colors.toolbarBg,
        border: `1px solid ${colors.toolbarBorder}`,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        color: colors.text,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        fontFamily: FONT,
      }}
    >
      {content}
    </div>
  );
}