"use client";

import { useState, useEffect, useRef } from "react";
import { Stage, Layer, Line, Text, Transformer } from "react-konva";

const GRID_SIZE = 50;
const GRID_MARK_SIZE = 4;

type TextObject = {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
};

export default function Canvas() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingScreenPos, setEditingScreenPos] = useState({ x: 0, y: 0 });

  const [isDark, setIsDark] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trRef = useRef<any>(null);
  const shapeRefs = useRef<Record<string, any>>({});

  // Theme colors — everything reads from here, so light/dark stay consistent
  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    grid: isDark ? "#333333" : "#dddddd",
    text: isDark ? "#ededed" : "#171717",
  };

  useEffect(() => {
    function updateSize() {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Detect system dark mode, and keep watching in case the user changes it live
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (editingId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        setTextObjects((prev) => prev.filter((o) => o.id !== selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingId]);

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

  function handleStageClick(e: any) {
    if (e.target !== e.target.getStage()) return;

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
    setEditingScreenPos({ x: pointer.x, y: pointer.y });
  }

  function commitEditing() {
    if (!editingId) return;

    setTextObjects((prev) => {
      const trimmed = editingValue.trim();
      if (trimmed === "") {
        return prev.filter((obj) => obj.id !== editingId);
      }
      return prev.map((obj) =>
        obj.id === editingId ? { ...obj, text: editingValue } : obj
      );
    });

    if (editingValue.trim() === "") {
      setSelectedId(null);
    }

    setEditingId(null);
    setEditingValue("");
  }

  function startEditingExisting(obj: TextObject) {
    setSelectedId(obj.id);
    setEditingId(obj.id);
    setEditingValue(obj.text);
    setEditingScreenPos({
      x: obj.x * stageScale + stagePos.x,
      y: obj.y * stageScale + stagePos.y,
    });
  }

  function handleTransformEnd(obj: TextObject) {
    const node = shapeRefs.current[obj.id];
    if (!node) return;

    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);

    const newFontSize = Math.max(8, Math.round(obj.fontSize * scaleX));

    setTextObjects((prev) =>
      prev.map((o) =>
        o.id === obj.id
          ? { ...o, fontSize: newFontSize, x: node.x(), y: node.y() }
          : o
      )
    );
  }

  function renderGrid() {
    if (dimensions.width === 0) return null;

    const startX = Math.floor(-stagePos.x / stageScale / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(-stagePos.y / stageScale / GRID_SIZE) * GRID_SIZE;
    const endX = startX + dimensions.width / stageScale + GRID_SIZE;
    const endY = startY + dimensions.height / stageScale + GRID_SIZE;

    const marks = [];
    for (let x = startX; x < endX; x += GRID_SIZE) {
      for (let y = startY; y < endY; y += GRID_SIZE) {
        marks.push(
          <Line
            key={`h-${x}-${y}`}
            points={[x - GRID_MARK_SIZE, y, x + GRID_MARK_SIZE, y]}
            stroke={colors.grid}
            strokeWidth={1}
          />
        );
        marks.push(
          <Line
            key={`v-${x}-${y}`}
            points={[x, y - GRID_MARK_SIZE, x, y + GRID_MARK_SIZE]}
            stroke={colors.grid}
            strokeWidth={1}
          />
        );
      }
    }
    return marks;
  }

  const editingObj = textObjects.find((o) => o.id === editingId);

  return (
    <div style={{ position: "relative", background: colors.background }}>
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
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        <Layer>{renderGrid()}</Layer>
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
                draggable
                ref={(node) => {
                  if (node) shapeRefs.current[obj.id] = node;
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  setSelectedId(obj.id);
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  startEditingExisting(obj);
                }}
                onDragEnd={(e) => {
                  setTextObjects((prev) =>
                    prev.map((o) =>
                      o.id === obj.id
                        ? { ...o, x: e.target.x(), y: e.target.y() }
                        : o
                    )
                  );
                }}
                onTransformEnd={() => handleTransformEnd(obj)}
              />
            ))}
          <Transformer
            ref={trRef}
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            rotateEnabled={false}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 20) return oldBox;
              return newBox;
            }}
          />
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
    </div>
  );
}