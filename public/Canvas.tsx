"use client";

import { useState, useEffect } from "react";
import { Stage, Layer, Line } from "react-konva";

const GRID_SIZE = 50;      // spacing between grid marks, in "world" units
const GRID_MARK_SIZE = 4;  // half-length of each little plus sign

export default function Canvas() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // Fill the whole browser window, and keep it filled if the window resizes
  useEffect(() => {
    function updateSize() {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Zoom in/out, centered on wherever the mouse pointer is
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
    const clampedScale = Math.max(0.1, Math.min(5, newScale)); // limit zoom range

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }

  // Draw plus-sign grid marks, but only within the currently visible area
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
            stroke="#dddddd"
            strokeWidth={1}
          />
        );
        marks.push(
          <Line
            key={`v-${x}-${y}`}
            points={[x, y - GRID_MARK_SIZE, x, y + GRID_MARK_SIZE]}
            stroke="#dddddd"
            strokeWidth={1}
          />
        );
      }
    }
    return marks;
  }

  return (
    <Stage
      width={dimensions.width}
      height={dimensions.height}
      draggable
      x={stagePos.x}
      y={stagePos.y}
      scaleX={stageScale}
      scaleY={stageScale}
      onWheel={handleWheel}
      onDragEnd={(e) => {
        setStagePos({ x: e.target.x(), y: e.target.y() });
      }}
    >
      <Layer>{renderGrid()}</Layer>
    </Stage>
  );
}