"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Stage, Layer, Text, Rect, Line, Circle, Group, Transformer } from "react-konva";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/useUser";
import type { TextObj, ShapeObj, LineObj, CanvasObject, Mode, Access } from "./canvasTypes";
import { Toolbar, PageBar, PageNameInput, WrapHandle, MiniMap, BoardStatus } from "./CanvasUI";

const GRID_SIZE = 50;
const HISTORY_LIMIT = 20;
const MIN_DRAW_SIZE = 5;

export default function Canvas({ boardId }: { boardId: string }) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProblem, setLoadProblem] = useState<"missing" | "error" | null>(null);
  const [pageName, setPageName] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>("edit");
  const [canEdit, setCanEdit] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pageNameFocused, setPageNameFocused] = useState(false);

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

  const [draft, setDraft] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);

  const { user, profile, loading: userLoading } = useUser();
  // The database tells us whether this visitor may edit; otherwise the page is view-only
  const isReadOnly = isLoaded && !canEdit;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trRef = useRef<any>(null);
  const shapeRefs = useRef<Record<string, any>>({});
  const lineRefs = useRef<Record<string, any>>({});
  const wrapHandleRefs = useRef<Record<string, any>>({});

  const pendingSaveRef = useRef(false);
  const latestRef = useRef({ objects, pageName, boardId, isReadOnly });
  latestRef.current = { objects, pageName, boardId, isReadOnly };

  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    grid: isDark ? "#333333" : "#dddddd",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#a3a3a3" : "#666666",
    toolbarBg: isDark ? "#1a1a1a" : "#ffffff",
    toolbarBorder: isDark ? "#333333" : "#e5e5e5",
    toolbarActiveBg: isDark ? "#6b6b6b" : "#5a5a5a",
    transformerStroke: isDark ? "#999999" : "#bbbbbb",
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

  useEffect(() => {
    setMinimapActive(true);
    if (minimapTimeoutRef.current) clearTimeout(minimapTimeoutRef.current);
    minimapTimeoutRef.current = setTimeout(() => setMinimapActive(false), 1200);
    return () => clearTimeout(minimapTimeoutRef.current);
  }, [stagePos, stageScale]);

  // Load the page through the database function: it only returns pages
  // this visitor is allowed to see, and needs the exact page id.
  useEffect(() => {
    async function loadBoard() {
      const { data, error } = await supabase.rpc("get_board", { board_id: boardId });
      if (error) {
        console.error("Load failed:", error);
        setLoadProblem("error");
        setIsLoaded(true);
        return;
      }
      if (!data) {
        setLoadProblem("missing");
        setIsLoaded(true);
        return;
      }
      const raw = (data.data ?? []) as CanvasObject[];
      setObjects(raw.filter((o) => !(o.type === "text" && o.text.trim() === "")));
      setPageName(data.name ?? null);
      setOwnerId(data.user_id ?? null);
      setAccess((data.access as Access) ?? "private");
      setCanEdit(!!data.can_edit);
      setIsLoaded(true);
    }
    loadBoard();
  }, [boardId]);

  // Autosave. Pending changes are also saved when you leave the page or hide
  // the tab, so the last thing you typed isn't lost.
  async function saveNow(): Promise<boolean> {
    const { objects: objs, pageName: name, boardId: id, isReadOnly: readOnly } = latestRef.current;
    if (readOnly || !pendingSaveRef.current) return false;
    pendingSaveRef.current = false;
    // Never store empty text boxes
    const cleaned = objs.filter((o) => !(o.type === "text" && o.text.trim() === ""));
    const { data, error } = await supabase.rpc("save_board", {
      board_id: id,
      new_data: cleaned,
      new_name: name,
    });
    if (error) {
      console.error("Save failed:", error);
      pendingSaveRef.current = true;
      return false;
    }
    if (data === false) {
      // The database refused (for example, sharing was turned off): go view-only
      console.error("Save refused: no permission to edit this page.");
      setCanEdit(false);
      return false;
    }
    return true;
  }

  async function manualSave() {
    if (latestRef.current.isReadOnly) return;
    pendingSaveRef.current = true;
    const ok = await saveNow();
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }
  }

  useEffect(() => {
    if (!isLoaded || isReadOnly) return;
    pendingSaveRef.current = true;
    const timeout = setTimeout(saveNow, 600);
    return () => clearTimeout(timeout);
  }, [objects, pageName, isLoaded, boardId, isReadOnly]);

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") saveNow();
    }
    window.addEventListener("pagehide", saveNow);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", saveNow);
      document.removeEventListener("visibilitychange", onHide);
      saveNow(); // leaving this page from inside the app
    };
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

  // Keep the browser tab title in sync: a manually set page name always
  // wins; otherwise fall back to the first text object's content, or
  // finally "New Page" if the page is empty.
  useEffect(() => {
    if (!isLoaded || loadProblem) return;

    if (pageName && pageName.trim().length > 0) {
      document.title = `${pageName.trim()} – Notebooook`;
      return;
    }

    const firstText = objects.find(
      (o): o is TextObj => o.type === "text" && o.text.trim().length > 0
    );

    if (firstText) {
      const preview = firstText.text.trim().split("\n")[0].slice(0, 40);
      document.title = `${preview} – Notebooook`;
    } else {
      document.title = "New Page – Notebooook";
    }
  }, [objects, pageName, isLoaded, loadProblem]);

  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      const currentObj = objects.find((o) => o.id === editingId) as TextObj | undefined;
      autosizeTextarea(textareaRef.current, !currentObj?.wrapWidth);
    }
  }, [editingId]);

  useEffect(() => {
    if (!trRef.current) return;
    const selectedObjForTr = objects.find((o) => o.id === selectedId);
    if (selectedObjForTr && selectedObjForTr.type !== "line" && shapeRefs.current[selectedId!]) {
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
      // Ctrl+S saves right away (works even while typing)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editingId) {
          commitEditing();
          setTimeout(manualSave, 50);
        } else {
          manualSave();
        }
        return;
      }

      if (editingId || pageNameFocused) return;

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
  }, [selectedId, editingId, objects, past, future, mode, pageNameFocused]);

  function autosizeTextarea(el: HTMLTextAreaElement, isAutoWidth: boolean) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    if (isAutoWidth) {
      el.style.width = "auto";
      el.style.width = Math.max(20, el.scrollWidth + 4) + "px";
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    const value = el.value;
    const cursorPos = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
    const currentLine = value.slice(lineStart, cursorPos);
    const currentObj = objects.find((o) => o.id === editingId) as TextObj | undefined;
    const isAutoWidth = !currentObj?.wrapWidth;

    if (currentLine === "- ") {
      const newValue = value.slice(0, lineStart) + "\u2022 " + value.slice(cursorPos);
      const newCursor = lineStart + 2;
      setEditingValue(newValue);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursor, newCursor);
          autosizeTextarea(textareaRef.current, isAutoWidth);
        }
      });
      return;
    }

    setEditingValue(value);
    autosizeTextarea(el, isAutoWidth);
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
      setDraft(null);
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
    setMode("select");
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
    const newObj: TextObj = { id: newId, type: "text", x: world.x, y: world.y, text: "", fontSize: 20, wrapWidth: null };

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
    if (type === "line") return;
    commitChange(
      objects.map((o) => (o.id === id ? { ...o, x: node.x(), y: node.y() } : o))
    );
  }

  function repositionWrapHandle(objId: string) {
    const textNode = shapeRefs.current[objId];
    const handleNode = wrapHandleRefs.current[objId];
    if (!textNode || !handleNode) return;

    const liveWidth = textNode.width() * textNode.scaleX();
    const liveHeight = textNode.height() * textNode.scaleY();

    handleNode.x(textNode.x() + liveWidth - 3);
    handleNode.y(textNode.y() + liveHeight / 2 - 10);
    handleNode.getLayer()?.batchDraw();
  }

  useLayoutEffect(() => {
    if (selectedId) repositionWrapHandle(selectedId);
  }, [objects, selectedId]);

  function handleTransformEnd(obj: TextObj | ShapeObj) {
    const node = shapeRefs.current[obj.id];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    if (obj.type === "text") {
      const newFontSize = Math.max(8, Math.round(obj.fontSize * scaleX));
      const baseWidth = obj.wrapWidth ?? node.width();
      const newWrapWidth = Math.max(40, Math.round(baseWidth * scaleX));
      commitChange(
        objects.map((o) =>
          o.id === obj.id && o.type === "text"
            ? { ...o, fontSize: newFontSize, wrapWidth: newWrapWidth, x: node.x(), y: node.y() }
            : o
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

  // Pages you can't edit are view-only
  useEffect(() => {
    if (isReadOnly) setMode("view");
  }, [isReadOnly]);

  async function claimBoard() {
    const { data, error } = await supabase.rpc("claim_board", { board_id: boardId });
    if (error || !data) {
      console.error("Claim failed:", error);
      return;
    }
    setOwnerId(user?.id ?? null);
    setAccess("private");
    setCanEdit(true);
  }

  // Returns a message to show in the share menu, or null if it worked
  async function changeAccess(next: Access): Promise<string | null> {
    const { data, error } = await supabase.rpc("set_board_access", {
      board_id: boardId,
      new_access: next,
    });
    if (error) {
      console.error("Share update failed:", error);
      return "Couldn't update sharing. Try again.";
    }
    if (data === "ok") {
      setAccess(next);
      return null;
    }
    if (data === "nb_plus_required") return "Anyone-can-edit links are an NB+ feature.";
    return "Only the page owner can change sharing.";
  }

  function switchMode(newMode: Mode) {
    if (isReadOnly && newMode !== "view") return;
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

  // Private or missing page (all hooks are above this line)
  if (loadProblem) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          textAlign: "center",
          padding: 20,
          background: colors.background,
          color: colors.text,
          fontFamily: "var(--font-funnel-sans), Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {loadProblem === "missing" ? "This page is private or doesn't exist." : "Couldn't load this page."}
        </div>
        <div style={{ fontSize: 14, color: colors.subtext }}>
          {loadProblem === "missing"
            ? "If it's yours, log in and try again."
            : "Check your connection and refresh."}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 14, fontWeight: 600 }}>
          {!user && !userLoading && (
            <Link
              href={`/login?next=${encodeURIComponent(`/b/${boardId}`)}`}
              style={{ color: colors.text }}
            >
              Log in
            </Link>
          )}
          <Link href="/" style={{ color: colors.text }}>
            Go home
          </Link>
        </div>
      </div>
    );
  }

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
      <PageBar
        homeHref={user ? "/my" : "/"}
        canSave={!isReadOnly}
        saved={savedFlash}
        onSave={manualSave}
        access={access}
        ownerId={ownerId}
        userId={user?.id ?? null}
        isPremium={profile?.is_premium ?? false}
        onChangeAccess={changeAccess}
        colors={colors}
      />

      <Toolbar mode={mode} onSelect={switchMode} readOnly={isReadOnly} colors={colors} />

      <PageNameInput
        pageName={pageName}
        setPageName={setPageName}
        readOnly={isReadOnly}
        colors={colors}
        onFocusChange={setPageNameFocused}
      />

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
                    width={obj.wrapWidth ?? undefined}
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
                    onDragMove={() => repositionWrapHandle(obj.id)}
                    onDragEnd={(e) => handleDragEnd(obj.id, e.target, "text")}
                    onTransform={() => repositionWrapHandle(obj.id)}
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
                    hitStrokeWidth={12}
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
                          e.cancelBubble = true;
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

          {selectedObj && selectedObj.type !== "line" && mode === "select" && selectedObj.id !== editingId && (
            <>
              <Transformer
                ref={trRef}
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                rotateEnabled={false}
                keepRatio={true}
                borderStroke={colors.transformerStroke}
                borderStrokeWidth={1.5}
                anchorStroke={colors.transformerStroke}
                anchorFill={isDark ? "#1a1a1a" : "#ffffff"}
                anchorSize={8}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />

              {selectedObj.type === "text" && (
                <WrapHandle
                  obj={selectedObj}
                  shapeRefs={shapeRefs}
                  wrapHandleRefs={wrapHandleRefs}
                  trRef={trRef}
                  commitChange={commitChange}
                  objects={objects}
                  colors={colors}
                />
              )}
            </>
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

              const lineCount = Math.max(1, editingValue.split("\n").length);
              const totalHeightWorld = (currentObj.fontSize ?? 20) * 1.2 * lineCount;
              const totalHeightScreen = totalHeightWorld * stageScale;
              const newScreenY = editingScreenPos.y + totalHeightScreen + 8;

              commitEditing();

              const newId = crypto.randomUUID();
              const newObj: TextObj = {
                id: newId,
                type: "text",
                x: currentObj.x,
                y: currentObj.y + totalHeightWorld + 8,
                text: "",
                fontSize: currentObj.fontSize,
                wrapWidth: currentObj.wrapWidth,
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
              const currentObjForAuto = objects.find((o) => o.id === editingId) as TextObj | undefined;
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
                  const newValue = value.slice(0, lineStart) + value.slice(cursorPos);
                  setEditingValue(newValue);
                  requestAnimationFrame(() => {
                    if (textareaRef.current) {
                      textareaRef.current.setSelectionRange(lineStart, lineStart);
                      autosizeTextarea(textareaRef.current, !currentObjForAuto?.wrapWidth);
                    }
                  });
                } else {
                  const insertion = "\n\u2022 ";
                  const newValue = value.slice(0, cursorPos) + insertion + value.slice(cursorPos);
                  const newCursor = cursorPos + insertion.length;
                  setEditingValue(newValue);
                  requestAnimationFrame(() => {
                    if (textareaRef.current) {
                      textareaRef.current.setSelectionRange(newCursor, newCursor);
                      autosizeTextarea(textareaRef.current, !currentObjForAuto?.wrapWidth);
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
            width: editingObj?.wrapWidth ? editingObj.wrapWidth * stageScale : undefined,
            fontSize: (editingObj?.fontSize ?? 20) * stageScale,
            lineHeight: 1.2,
            fontFamily: "var(--font-funnel-sans), Arial, sans-serif",
            color: colors.text,
            background: "transparent",
            border: "none",
            outline: `1px dashed ${isDark ? "#666666" : "#999999"}`,
            outlineOffset: "3px",
            padding: 0,
            margin: 0,
            resize: "none",
            overflow: "hidden",
            whiteSpace: editingObj?.wrapWidth ? "pre-wrap" : "pre",
            wordBreak: "normal",
            overflowWrap: "break-word",
            transition: "height 0.08s ease-out",
          }}
        />
      )}

      <BoardStatus
        isLoaded={isLoaded}
        userLoading={userLoading}
        ownerId={ownerId}
        user={user}
        isReadOnly={isReadOnly}
        boardId={boardId}
        onClaim={claimBoard}
        colors={colors}
      />

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