"use client";

import { useState, useEffect, useRef } from "react";
import { Stage, Layer, Text, Transformer } from "react-konva";

const GRID_SIZE = 50; // base grid spacing, in world units
const HISTORY_LIMIT = 20;
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 130;

type TextObject = {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
};

type Mode = "view" | "edit";

export default function Canvas() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingScreenPos, setEditingScreenPos] = useState({ x: 0, y: 0 });
  const [editingIsNew, setEditingIsNew] = useState(false);

  const [isDark, setIsDark] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");

  const [past, setPast] = useState<TextObject[][]>([]);
  const [future, setFuture] = useState<TextObject[][]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trRef = useRef<any>(null);
  const shapeRefs = useRef<Record<string, any>>({});

  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    grid: isDark ? "#333333" : "#dddddd",
    text: isDark ? "#ededed" : "#171717",
    toolbarBg: isDark ? "#1a1a1a" : "#f5f5f5",
    toolbarBorder: isDark ? "#333333" : "#dddddd",
    toolbarActiveBg: isDark ? "#3b82f6" : "#2563eb",
    minimapBg: isDark ? "#1a1a1a" : "#f0f0f0",
    minimapDot: isDark ? "#888888" : "#666666",
    minimapViewport: isDark ? "#3b82f6" : "#2563eb",
  };

  // Keeps on-screen grid spacing within a comfortable range (20-100px)
  // regardless of zoom level, by doubling/halving the world-space spacing.
  function getEffectiveGridSize(scale: number) {
    let size = GRID_SIZE;
    while (size * scale < 20) size *= 2;
    while (size * scale > 100) size /= 2;
    return size;
  }

  function getGridBackgroundImage(color: string, tileSize: number) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tileSize}' height='${tileSize}'><line x1='${
      tileSize / 2 - 4
    }' y1='${tileSize / 2}' x2='${tileSize / 2 + 4}' y2='${
      tileSize / 2
    }' stroke='${color}' stroke-width='1'/><line x1='${tileSize / 2}' y1='${
      tileSize / 2 - 4
    }' x2='${tileSize / 2}' y2='${tileSize / 2 + 4}' stroke='${color}' stroke-width='1'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  useEffect(() => {
    function updateSize() {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      autosizeTextarea(textareaRef.current);
    }
  }, [editingId]);

  useEffect(() => {
    if (trRef.current) {
      if (selectedId && shapeRefs.current[selectedId]) {
        trRef.current.nodes([shapeRefs.current[selectedId]]);
      } else {
        trRef.current.nodes([]);
      }
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, textObjects]);

  function commitChange(newState: TextObject[]) {
    setPast((prev) => [...prev, textObjects].slice(-HISTORY_LIMIT));
    setFuture([]);
    setTextObjects(newState);
  }

  function undo() {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [textObjects, ...prev].slice(0, HISTORY_LIMIT));
    setTextObjects(previous);
    setSelectedId(null);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, textObjects].slice(-HISTORY_LIMIT));
    setTextObjects(next);
    setSelectedId(null);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (editingId) return;

      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      const isRedo =
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y");

      if (isUndo) {
        e.preventDefault();
        undo();
        return;
      }
      if (isRedo) {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        commitChange(textObjects.filter((o) => o.id !== selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingId, textObjects, past, future]);

  function autosizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.width = "auto";
    el.style.height = el.scrollHeight + "px";
    el.style.width = Math.max(20, el.scrollWidth + 4) + "px";
  }

  function handleWheel(e: any) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const scaleBy = 1.05;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }

  // Fires continuously while dragging the blank canvas — keeps the CSS grid
  // in sync with Konva's live movement instead of only updating at drag-end,
  // which is what caused the "frozen grid" choppiness.
  function handleStageDragMove(e: any) {
    if (e.target === e.target.getStage()) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  }

  function handleStageClick(e: any) {
    if (e.target !== e.target.getStage()) return;
    if (mode !== "edit") return;

    if (selectedId) {
      setSelectedId(null);
      return;
    }

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const worldX = (pointer.x - stagePos.x) / stageScale;
    const worldY = (pointer.y - stagePos.y) / stageScale;

    const newId = crypto.randomUUID();
    const newObj: TextObject = { id: newId, x: worldX, y: worldY, text: "", fontSize: 20 };

    setTextObjects((prev) => [...prev, newObj]);
    setSelectedId(newId);
    setEditingId(newId);
    setEditingValue("");
    setEditingIsNew(true);
    setEditingScreenPos({ x: pointer.x, y: pointer.y });
  }

  function commitEditing() {
    if (!editingId) return;
    const trimmed = editingValue.trim();

    if (trimmed === "") {
      setTextObjects((prev) => prev.filter((obj) => obj.id !== editingId));
      setSelectedId(null);
    } else if (editingIsNew) {
      const before = textObjects.filter((o) => o.id !== editingId);
      const after = textObjects.map((o) =>
        o.id === editingId ? { ...o, text: editingValue } : o
      );
      setPast((prev) => [...prev, before].slice(-HISTORY_LIMIT));
      setFuture([]);
      setTextObjects(after);
    } else {
      const after = textObjects.map((o) =>
        o.id === editingId ? { ...o, text: editingValue } : o
      );
      commitChange(after);
    }

    setEditingId(null);
    setEditingValue("");
    setEditingIsNew(false);
  }

  function startEditingExisting(obj: TextObject) {
    if (mode !== "edit") return;
    setSelectedId(obj.id);
    setEditingId(obj.id);
    setEditingValue(obj.text);
    setEditingIsNew(false);
    setEditingScreenPos({
      x: obj.x * stageScale + stagePos.x,
      y: obj.y * stageScale + stagePos.y,
    });
  }

  function handleDragEnd(obj: TextObject, node: any) {
    commitChange(
      textObjects.map((o) =>
        o.id === obj.id ? { ...o, x: node.x(), y: node.y() } : o
      )
    );
  }

  function handleTransformEnd(obj: TextObject) {
    const node = shapeRefs.current[obj.id];
    if (!node) return;

    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);

    const newFontSize = Math.max(8, Math.round(obj.fontSize * scaleX));

    commitChange(
      textObjects.map((o) =>
        o.id === obj.id
          ? { ...o, fontSize: newFontSize, x: node.x(), y: node.y() }
          : o
      )
    );
  }

  function switchMode(newMode: Mode) {
    if (editingId) commitEditing();
    setSelectedId(null);
    setMode(newMode);
  }

  // Recenters the viewport on a given world coordinate — used by minimap clicks
  function navigateTo(worldX: number, worldY: number) {
    setStagePos({
      x: dimensions.width / 2 - worldX * stageScale,
      y: dimensions.height / 2 - worldY * stageScale,
    });
  }

  const editingObj = textObjects.find((o) => o.id === editingId);
  const effectiveGridSize = getEffectiveGridSize(stageScale);

  return (
    <div
      style={{
        position: "relative",
        backgroundColor: colors.background,
        backgroundImage: getGridBackgroundImage(colors.grid, effectiveGridSize),
        backgroundSize: `${effectiveGridSize * stageScale}px ${
          effectiveGridSize * stageScale
        }px`,
        backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          display: "flex",
          gap: 6,
          background: colors.toolbarBg,
          border: `1px solid ${colors.toolbarBorder}`,
          borderRadius: 8,
          padding: 6,
        }}
      >
        <ToolbarButton
          label="View"
          active={mode === "view"}
          onClick={() => switchMode("view")}
          colors={colors}
        />
        <ToolbarButton
          label="Edit Text"
          active={mode === "edit"}
          onClick={() => switchMode("edit")}
          colors={colors}
        />
        <ToolbarButton label="Line" disabled title="Coming soon" colors={colors} />
        <ToolbarButton label="Shape" disabled title="Coming soon" colors={colors} />
      </div>

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        draggable
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onDragMove={handleStageDragMove}
        onDragEnd={handleStageDragMove}
      >
        <Layer>
          {textObjects
            .filter((obj) => obj.id !== editingId)
            .map((obj) => (
              <Text
                key={obj.id}
                text={obj.text}
                x={obj.x}
                y={obj.y}
                fontSize={obj.fontSize}
                fill={colors.text}
                draggable={mode === "edit"}
                ref={(node) => {
                  if (node) shapeRefs.current[obj.id] = node;
                }}
                onClick={(e) => {
                  if (mode !== "edit") return;
                  e.cancelBubble = true;
                  setSelectedId(obj.id);
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  startEditingExisting(obj);
                }}
                onDragEnd={(e) => handleDragEnd(obj, e.target)}
                onTransformEnd={() => handleTransformEnd(obj)}
              />
            ))}
          {mode === "edit" && (
            <Transformer
              ref={trRef}
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              rotateEnabled={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20) return oldBox;
                return newBox;
              }}
            />
          )}
        </Layer>
      </Stage>

      {editingId && (
        <textarea
          ref={textareaRef}
          value={editingValue}
          onChange={(e) => {
            setEditingValue(e.target.value);
            autosizeTextarea(e.target);
          }}
          onBlur={commitEditing}
          onKeyDown={(e) => {
            if (e.key === "Escape") commitEditing();
          }}
          style={{
            position: "absolute",
            top: editingScreenPos.y,
            left: editingScreenPos.x,
            fontSize: (editingObj?.fontSize ?? 20) * stageScale,
            lineHeight: 1.2,
            fontFamily: "Arial, Helvetica, sans-serif",
            color: colors.text,
            background: "transparent",
            border: "none",
            outline: `1px dashed ${isDark ? "#666666" : "#999999"}`,
            outlineOffset: "3px",
            padding: 0,
            margin: 0,
            resize: "none",
            overflow: "hidden",
            whiteSpace: "pre",
          }}
        />
      )}

      <MiniMap
        textObjects={textObjects}
        stagePos={stagePos}
        stageScale={stageScale}
        dimensions={dimensions}
        colors={colors}
        onNavigate={navigateTo}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  title,
  onClick,
  colors,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  colors: any;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        border: "none",
        fontSize: 14,
        fontFamily: "Arial, Helvetica, sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        background: active ? colors.toolbarActiveBg : "transparent",
        color: active ? "#ffffff" : disabled ? "#999999" : colors.text,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function MiniMap({
  textObjects,
  stagePos,
  stageScale,
  dimensions,
  colors,
  onNavigate,
}: {
  textObjects: TextObject[];
  stagePos: { x: number; y: number };
  stageScale: number;
  dimensions: { width: number; height: number };
  colors: any;
  onNavigate: (worldX: number, worldY: number) => void;
}) {
  if (dimensions.width === 0) return null;

  // Current viewport, in world coordinates
  const viewport = {
    left: -stagePos.x / stageScale,
    top: -stagePos.y / stageScale,
    right: (-stagePos.x + dimensions.width) / stageScale,
    bottom: (-stagePos.y + dimensions.height) / stageScale,
  };

  // Rough bounding box for each text object (approximated — we don't have
  // exact rendered text width without measuring, so this is a fair estimate)
  const objectBounds = textObjects.map((obj) => ({
    left: obj.x,
    top: obj.y,
    right: obj.x + Math.max(60, obj.text.length * obj.fontSize * 0.55),
    bottom: obj.y + obj.fontSize * 1.4,
  }));

  // Union of viewport + all objects, so the viewport indicator is always
  // visible on the minimap even if you've panned away from your notes
  const allLefts = [viewport.left, ...objectBounds.map((b) => b.left)];
  const allTops = [viewport.top, ...objectBounds.map((b) => b.top)];
  const allRights = [viewport.right, ...objectBounds.map((b) => b.right)];
  const allBottoms = [viewport.bottom, ...objectBounds.map((b) => b.bottom)];

  const PADDING = 100; // world units of breathing room
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

  return (
    <div
      onClick={handleMinimapClick}
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