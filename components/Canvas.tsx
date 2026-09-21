"use client";

import { useState, useEffect, useRef } from "react";
import { Stage, Layer, Text, Rect, Line, Circle, Group, Transformer } from "react-konva";
import { MousePointer2, Eye, Type, Square, Slash } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const GRID_SIZE = 50;
const HISTORY_LIMIT = 20;
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 130;
const MIN_DRAW_SIZE = 5; // ignore accidental tiny clicks when drawing shapes/lines

type TextObj = { id: string; type: "text"; x: number; y: number; text: string; fontSize: number };
type ShapeObj = { id: string; type: "shape"; x: number; y: number; width: number; height: number };
type LineObj = { id: string; type: "line"; x1: number; y1: number; x2: number; y2: number };
type CanvasObject = TextObj | ShapeObj | LineObj;

type Mode = "view" | "select" | "text" | "line" | "shape";

export default function Canvas({ boardId }: { boardId: string }) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  const [minimapActive, setMinimapActive] = useState(true);
  const minimapTimeoutRef = useRef<any>(null);

  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingScreenPos, setEditingScreenPos] = useState({ x: 0, y: 0 });
  const [editingIsNew, setEditingIsNew] = useState(false);

  const [isDark, setIsDark] = useState(false);
  const [mode, setMode] = useState<Mode>("select");

  const [past, setPast] = useState<CanvasObject[][]>([]);
  const [future, setFuture] = useState<CanvasObject[][]>([]);

  // Tracks an in-progress shape/line drag before it's committed as a real object
  const [draft, setDraft] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trRef = useRef<any>(null);
  const shapeRefs = useRef<Record<string, any>>({});
  const lineRefs = useRef<Record<string, any>>({});
  
  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    grid: isDark ? "#333333" : "#dddddd",
    text: isDark ? "#ededed" : "#171717",
    toolbarBg: isDark ? "#1a1a1a" : "#ffffff",
    toolbarBorder: isDark ? "#333333" : "#e5e5e5",
    toolbarActiveBg: isDark ? "#6b6b6b" : "#5a5a5a",
    toolbarHoverBg: isDark ? "#2a2a2a" : "#f0f0f0",
    minimapBg: isDark ? "#1a1a1a" : "#f0f0f0",
    minimapDot: isDark ? "#888888" : "#666666",
    minimapViewport: isDark ? "#6b6b6b" : "#5a5a5a",
    draftStroke: isDark ? "#6b6b6b" : "#5a5a5a",
  };

  function getEffectiveGridSize(scale: number) {
    let size = GRID_SIZE;
    while (size * scale < 20) size *= 2;
    while (size * scale > 100) size /= 2;
    return size;
  }

  function getGridBackgroundImage(color: string, tileSize: number) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tileSize}' height='${tileSize}'><line x1='${tileSize / 2 - 4}' y1='${tileSize / 2}' x2='${tileSize / 2 + 4}' y2='${tileSize / 2}' stroke='${color}' stroke-width='1'/><line x1='${tileSize / 2}' y1='${tileSize / 2 - 4}' x2='${tileSize / 2}' y2='${tileSize / 2 + 4}' stroke='${color}' stroke-width='1'/></svg>`;
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

  // Minimap fully visible while actively panning/zooming, then dims after
  // a brief pause — matches how most design tools handle minimap visibility.
  useEffect(() => {
    setMinimapActive(true);
    if (minimapTimeoutRef.current) clearTimeout(minimapTimeoutRef.current);
    minimapTimeoutRef.current = setTimeout(() => setMinimapActive(false), 1200);
    return () => clearTimeout(minimapTimeoutRef.current);
  }, [stagePos, stageScale]);

  // Load this board's saved content once, when the page first opens
  useEffect(() => {
    async function loadBoard() {
      const { data, error } = await supabase
        .from("boards")
        .select("data")
        .eq("id", boardId)
        .single();
      if (error) console.error("Load failed:", error);

      if (data) {
        setObjects(data.data as CanvasObject[]);
      }
      setIsLoaded(true);
    }
    loadBoard();
  }, [boardId]);

  // Autosave — waits 800ms after your last change before actually saving,
  // so rapid edits don't spam the database with a request per keystroke
  useEffect(() => {
    if (!isLoaded) return; // don't save until the initial load has finished

    const timeout = setTimeout(async () => {
      const { error } = await supabase
        .from("boards")
        .update({ data: objects, updated_at: new Date().toISOString() })
        .eq("id", boardId);
      if (error) console.error("Save failed:", error);
    }, 800);

    return () => clearTimeout(timeout);
  }, [objects, isLoaded, boardId]);

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

  // Only attach the resize Transformer for text/shape — lines use their own
  // endpoint-handle system since scaling a raw line doesn't map cleanly
  // onto "resize" the way it does for a box of text or a rectangle.
  useEffect(() => {
    if (!trRef.current) return;
    const selectedObj = objects.find((o) => o.id === selectedId);
    if (selectedObj && selectedObj.type !== "line" && shapeRefs.current[selectedId!]) {
      trRef.current.nodes([shapeRefs.current[selectedId!]]);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId, objects]);

  function commitChange(newState: CanvasObject[]) {
    setPast((prev) => [...prev, objects].slice(-HISTORY_LIMIT));
    setFuture([]);
    setObjects(newState);
  }

  function undo() {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [objects, ...prev].slice(0, HISTORY_LIMIT));
    setObjects(previous);
    setSelectedId(null);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, objects].slice(-HISTORY_LIMIT));
    setObjects(next);
    setSelectedId(null);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (editingId) return; // never intercept keys while actively typing

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
        commitChange(objects.filter((o) => o.id !== selectedId));
        setSelectedId(null);
        return;
      }

      // Tool-switching shortcuts — only plain letter presses, no modifier keys,
      // so Ctrl+V (paste), Cmd+T (new browser tab), etc. still work normally.
      const noModifiers = !e.ctrlKey && !e.metaKey && !e.altKey;

      if (noModifiers) {
        const key = e.key.toLowerCase();
        if (key === "v") {
          switchMode("view");
          return;
        }
        if (key === "s") {
          switchMode("select");
          return;
        }
        if (key === "t") {
          switchMode("text");
          return;
        }
        if (key === "l") {
          switchMode("line");
          return;
        }
        if (key === "r") {
          switchMode("shape");
          return;
        }
        if (e.key === "Escape") {
          if (selectedId) {
            setSelectedId(null);
          } else {
            switchMode("select");
          }
          return;
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingId, objects, past, future, mode]);

  function autosizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.width = "auto";
    el.style.height = el.scrollHeight + "px";
    el.style.width = Math.max(20, el.scrollWidth + 4) + "px";
  }

  // Handles the "- " -> "• " auto-bullet conversion as you type
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    const value = el.value;
    const cursorPos = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
    const currentLine = value.slice(lineStart, cursorPos);

    if (currentLine === "- ") {
      const newValue = value.slice(0, lineStart) + "\u2022 " + value.slice(cursorPos);
      const newCursor = lineStart + 2;
      setEditingValue(newValue);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursor, newCursor);
          autosizeTextarea(textareaRef.current);
        }
      });
      return;
    }

    setEditingValue(value);
    autosizeTextarea(el);
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

  function handleStageDragMove(e: any) {
    if (e.target === e.target.getStage()) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  }

  function toWorld(pointer: { x: number; y: number }) {
    return {
      x: (pointer.x - stagePos.x) / stageScale,
      y: (pointer.y - stagePos.y) / stageScale,
    };
  }

  function handleStageMouseDown(e: any) {
    if (e.target !== e.target.getStage()) return;
    if (mode !== "line" && mode !== "shape") return;

    const pointer = e.target.getStage().getPointerPosition();
    const world = toWorld(pointer);
    setDraft({ start: world, current: world });
  }

  function handleStageMouseMove(e: any) {
    if (!draft) return;
    const pointer = e.target.getStage().getPointerPosition();
    setDraft({ ...draft, current: toWorld(pointer) });
  }

  function handleStageMouseUp() {
    if (!draft) return;

    const { start, current } = draft;
    const dx = Math.abs(current.x - start.x);
    const dy = Math.abs(current.y - start.y);

    if (dx < MIN_DRAW_SIZE && dy < MIN_DRAW_SIZE) {
      setDraft(null); // too small — treat as an accidental click, not a real draw
      return;
    }

    const newId = crypto.randomUUID();
    let newObj: CanvasObject;

    if (mode === "shape") {
      newObj = {
        id: newId,
        type: "shape",
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: dx,
        height: dy,
      };
    } else {
      newObj = { id: newId, type: "line", x1: start.x, y1: start.y, x2: current.x, y2: current.y };
    }

    commitChange([...objects, newObj]);
    setDraft(null);
    setSelectedId(newId);
    setMode("select"); // draw once, then immediately drop into select mode to adjust it
  }

  function handleStageClick(e: any) {
    if (e.target !== e.target.getStage()) return;
    if (mode !== "select" && mode !== "text") return;

    if (selectedId) {
      setSelectedId(null);
      return;
    }

    if (mode !== "text") return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const world = toWorld(pointer);

    const newId = crypto.randomUUID();
    const newObj: TextObj = { id: newId, type: "text", x: world.x, y: world.y, text: "", fontSize: 20 };

    setObjects((prev) => [...prev, newObj]);
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
      setObjects((prev) => prev.filter((obj) => obj.id !== editingId));
      setSelectedId(null);
    } else if (editingIsNew) {
      const before = objects.filter((o) => o.id !== editingId);
      const after = objects.map((o) =>
        o.id === editingId && o.type === "text" ? { ...o, text: editingValue } : o
      );
      setPast((prev) => [...prev, before].slice(-HISTORY_LIMIT));
      setFuture([]);
      setObjects(after);
    } else {
      const after = objects.map((o) =>
        o.id === editingId && o.type === "text" ? { ...o, text: editingValue } : o
      );
      commitChange(after);
    }

    setEditingId(null);
    setEditingValue("");
    setEditingIsNew(false);
  }

  function startEditingExisting(obj: TextObj) {
    if (mode !== "select") return;
    setSelectedId(obj.id);
    setEditingId(obj.id);
    setEditingValue(obj.text);
    setEditingIsNew(false);
    setEditingScreenPos({
      x: obj.x * stageScale + stagePos.x,
      y: obj.y * stageScale + stagePos.y,
    });
  }

  function handleDragEnd(id: string, node: any, type: CanvasObject["type"]) {
    if (type === "line") return; // lines handle their own drag logic separately
    commitChange(
      objects.map((o) => (o.id === id ? { ...o, x: node.x(), y: node.y() } : o))
    );
  }

  function handleTransformEnd(obj: TextObj | ShapeObj) {
    const node = shapeRefs.current[obj.id];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    if (obj.type === "text") {
      const newFontSize = Math.max(8, Math.round(obj.fontSize * scaleX));
      commitChange(
        objects.map((o) =>
          o.id === obj.id ? { ...o, fontSize: newFontSize, x: node.x(), y: node.y() } : o
        )
      );
    } else {
      const newWidth = Math.max(10, Math.round(obj.width * scaleX));
      const newHeight = Math.max(10, Math.round(obj.height * scaleY));
      commitChange(
        objects.map((o) =>
          o.id === obj.id ? { ...o, width: newWidth, height: newHeight, x: node.x(), y: node.y() } : o
        )
      );
    }
  }

  // Moving a whole line by dragging its body (not an endpoint)
  function handleLineBodyDragEnd(obj: LineObj, node: any) {
    const dx = node.x();
    const dy = node.y();
    node.x(0);
    node.y(0);
    commitChange(
      objects.map((o) =>
        o.type === "line" && o.id === obj.id
          ? { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }
          : o
      )
    );
  }

  // Dragging a single endpoint handle to reshape the line
  function handleLineEndpointDragEnd(obj: LineObj, which: "1" | "2", node: any) {
    const world = { x: node.x(), y: node.y() };
    commitChange(
      objects.map((o) =>
        o.type === "line" && o.id === obj.id
          ? which === "1"
            ? { ...o, x1: world.x, y1: world.y }
            : { ...o, x2: world.x, y2: world.y }
          : o
      )
    );
  }

  function switchMode(newMode: Mode) {
    if (editingId) commitEditing();
    setSelectedId(null);
    setDraft(null);
    setMode(newMode);
  }

  function navigateTo(worldX: number, worldY: number) {
    setStagePos({
      x: dimensions.width / 2 - worldX * stageScale,
      y: dimensions.height / 2 - worldY * stageScale,
    });
  }

  const editingObj = objects.find((o) => o.id === editingId) as TextObj | undefined;
  const effectiveGridSize = getEffectiveGridSize(stageScale);
  const selectedObj = objects.find((o) => o.id === selectedId);
  const cursorStyle =
    mode === "line" || mode === "shape" ? "crosshair" : mode === "view" ? "grab" : "default";

  return (
    <div
      style={{
        position: "relative",
        cursor: cursorStyle,
        backgroundColor: colors.background,
        backgroundImage: getGridBackgroundImage(colors.grid, effectiveGridSize),
        backgroundSize: `${effectiveGridSize * stageScale}px ${effectiveGridSize * stageScale}px`,
        backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
      }}
    >
      <Toolbar mode={mode} onSelect={switchMode} colors={colors} />

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        draggable={mode === "view" || mode === "select"}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDragMove={handleStageDragMove}
        onDragEnd={handleStageDragMove}
      >
        <Layer>
          {objects
            .filter((obj) => obj.id !== editingId)
            .map((obj) => {
              if (obj.type === "text") {
                return (
                  <Text
                    key={obj.id}
                    text={obj.text}
                    x={obj.x}
                    y={obj.y}
                    fontSize={obj.fontSize}
                    lineHeight={1.2}
                    fill={colors.text}
                    draggable={mode === "select"}
                    ref={(node) => {
                      if (node) shapeRefs.current[obj.id] = node;
                    }}
                    onClick={(e) => {
                      if (mode !== "select") return;
                      e.cancelBubble = true;
                      setSelectedId(obj.id);
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      startEditingExisting(obj);
                    }}
                    onDragEnd={(e) => handleDragEnd(obj.id, e.target, "text")}
                    onTransformEnd={() => handleTransformEnd(obj)}
                  />
                );
              }

              if (obj.type === "shape") {
                return (
                  <Rect
                    key={obj.id}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    stroke={colors.text}
                    strokeWidth={2}
                    hitStrokeWidth={12} // clickable zone: the outline, plus a few px of margin
                    draggable={mode === "select"}
                    ref={(node) => {
                      if (node) shapeRefs.current[obj.id] = node;
                    }}
                    onClick={(e) => {
                      if (mode !== "select") return;
                      e.cancelBubble = true;
                      setSelectedId(obj.id);
                    }}
                    onDragEnd={(e) => handleDragEnd(obj.id, e.target, "shape")}
                    onTransformEnd={() => handleTransformEnd(obj)}
                  />
                );
              }

              // Line — grouped so the body and endpoint handles move together
              // live as one unit; endpoint drags also live-update the line shape.
              const isSelected = obj.id === selectedId;
              return (
                <Group
                  key={obj.id}
                  draggable={mode === "select"}
                  onDragEnd={(e) => handleLineBodyDragEnd(obj, e.target)}
                >
                  <Line
                    ref={(node) => {
                      if (node) lineRefs.current[obj.id] = node;
                    }}
                    points={[obj.x1, obj.y1, obj.x2, obj.y2]}
                    stroke={colors.text}
                    strokeWidth={3}
                    hitStrokeWidth={16}
                    onClick={(e) => {
                      if (mode !== "select") return;
                      e.cancelBubble = true;
                      setSelectedId(obj.id);
                    }}
                  />
                  {isSelected && mode === "select" && (
                    <>
                      <Circle
                        x={obj.x1}
                        y={obj.y1}
                        radius={6}
                        fill={colors.toolbarActiveBg}
                        draggable
                        onDragStart={(e) => {
                          e.cancelBubble = true; // don't also trigger the group's body-drag
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const lineNode = lineRefs.current[obj.id];
                          if (lineNode) {
                            const pts = lineNode.points();
                            lineNode.points([e.target.x(), e.target.y(), pts[2], pts[3]]);
                            lineNode.getLayer()?.batchDraw();
                          }
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          handleLineEndpointDragEnd(obj, "1", e.target);
                        }}
                      />
                      <Circle
                        x={obj.x2}
                        y={obj.y2}
                        radius={6}
                        fill={colors.toolbarActiveBg}
                        draggable
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const lineNode = lineRefs.current[obj.id];
                          if (lineNode) {
                            const pts = lineNode.points();
                            lineNode.points([pts[0], pts[1], e.target.x(), e.target.y()]);
                            lineNode.getLayer()?.batchDraw();
                          }
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          handleLineEndpointDragEnd(obj, "2", e.target);
                        }}
                      />
                    </>
                  )}
                </Group>
              );
            })}

          {draft && (mode === "shape" ? (
            <Rect
              x={Math.min(draft.start.x, draft.current.x)}
              y={Math.min(draft.start.y, draft.current.y)}
              width={Math.abs(draft.current.x - draft.start.x)}
              height={Math.abs(draft.current.y - draft.start.y)}
              stroke={colors.draftStroke}
              strokeWidth={2}
              dash={[6, 4]}
              fill="transparent"
              listening={false}
            />
          ) : (
            <Line
              points={[draft.start.x, draft.start.y, draft.current.x, draft.current.y]}
              stroke={colors.draftStroke}
              strokeWidth={3}
              dash={[6, 4]}
              listening={false}
            />
          ))}

          {selectedObj && selectedObj.type !== "line" && mode === "select" && (
            <Transformer
              ref={trRef}
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              rotateEnabled={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return oldBox;
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
          onChange={handleTextareaChange}
          onBlur={commitEditing}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              commitEditing();
              return;
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              const currentObj = objects.find((o) => o.id === editingId) as TextObj | undefined;
              if (!currentObj) return;

              // Count actual lines in the text being typed right now (including
              // any wraps from the bullet-list feature), not just fontSize alone,
              // so the new box drops below wherever this one really ends.
              const lineCount = Math.max(1, editingValue.split("\n").length);
              const totalHeightWorld = (currentObj.fontSize ?? 20) * 1.2 * lineCount;
              const totalHeightScreen = totalHeightWorld * stageScale;
              const newScreenY = editingScreenPos.y + totalHeightScreen + 8;

              commitEditing(); // save whatever's currently being typed first

              const newId = crypto.randomUUID();
              const newObj: TextObj = {
                id: newId,
                type: "text",
                x: currentObj.x,
                y: currentObj.y + totalHeightWorld + 8,
                text: "",
                fontSize: currentObj.fontSize,
              };

              setObjects((prev) => [...prev, newObj]);
              setSelectedId(newId);
              setEditingId(newId);
              setEditingValue("");
              setEditingIsNew(true);
              setEditingScreenPos({ x: editingScreenPos.x, y: newScreenY });
              return;
            }
            if (e.key === "Enter") {
              const el = e.currentTarget;
              const value = el.value;
              const cursorPos = el.selectionStart;
              const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
              const currentLine = value.slice(lineStart, cursorPos);
              const bulletMatch = currentLine.match(/^\u2022 (.*)$/);

              if (bulletMatch) {
                e.preventDefault();
                const content = bulletMatch[1];

                if (content.trim() === "") {
                  // Empty bullet line + Enter = stop the list (remove the bullet)
                  const newValue = value.slice(0, lineStart) + value.slice(cursorPos);
                  setEditingValue(newValue);
                  requestAnimationFrame(() => {
                    if (textareaRef.current) {
                      textareaRef.current.setSelectionRange(lineStart, lineStart);
                      autosizeTextarea(textareaRef.current);
                    }
                  });
                } else {
                  // Continue the list on the next line
                  const insertion = "\n\u2022 ";
                  const newValue = value.slice(0, cursorPos) + insertion + value.slice(cursorPos);
                  const newCursor = cursorPos + insertion.length;
                  setEditingValue(newValue);
                  requestAnimationFrame(() => {
                    if (textareaRef.current) {
                      textareaRef.current.setSelectionRange(newCursor, newCursor);
                      autosizeTextarea(textareaRef.current);
                    }
                  });
                }
              }
            }
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
        objects={objects}
        stagePos={stagePos}
        stageScale={stageScale}
        dimensions={dimensions}
        colors={colors}
        onNavigate={navigateTo}
        active={minimapActive}
      />
    </div>
  );
}

function Toolbar({
  mode,
  onSelect,
  colors,
}: {
  mode: Mode;
  onSelect: (m: Mode) => void;
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
        top: 16,
        left: 16,
        zIndex: 10,
        display: "flex",
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
        return (
          <button
            key={m}
            title={label}
            onClick={() => onSelect(m)}
            style={{
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              background: active ? colors.toolbarActiveBg : "transparent",
              color: active ? "#ffffff" : colors.text,
              transition: "background 0.12s ease",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = colors.toolbarHoverBg;
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

function MiniMap({
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