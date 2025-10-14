import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./SimulatorV2.css";

const GRID_WIDTH = 200;
const GRID_HEIGHT = 100;
const CELL_SIZE = 6;

const SLIPBOT_LENGTH = 17;
const SLIPBOT_WIDTH = 8;
const TRAILER_LENGTH = SLIPBOT_LENGTH * 3 + 6;
const TRAILER_WIDTH = SLIPBOT_WIDTH + 6;

const SLIPBOT_COLORS = ["#38bdf8", "#22c55e", "#f97316", "#c084fc", "#facc15"];

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

function normalizeAngle(angle) {
  const value = Number.isFinite(angle) ? angle : 0;
  return ((value % 360) + 360) % 360;
}

function getRotatedBoundingBox(width, height, rotation) {
  const radians = degToRad(rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const boxWidth = Math.abs(width * cos) + Math.abs(height * sin);
  const boxHeight = Math.abs(width * sin) + Math.abs(height * cos);
  return { width: boxWidth, height: boxHeight };
}

function clampCenterToBounds(center, width, height, rotation) {
  const { width: boxWidth, height: boxHeight } = getRotatedBoundingBox(width, height, rotation);
  const halfWidth = boxWidth / 2;
  const halfHeight = boxHeight / 2;
  return {
    x: Math.min(Math.max(center.x, halfWidth), GRID_WIDTH - halfWidth),
    y: Math.min(Math.max(center.y, halfHeight), GRID_HEIGHT - halfHeight)
  };
}

function pointInRectangle(entity, point) {
  const radians = degToRad(entity.rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - entity.center.x;
  const dy = point.y - entity.center.y;
  const localX = cos * dx + sin * dy;
  const localY = -sin * dx + cos * dy;
  return Math.abs(localX) <= entity.width / 2 && Math.abs(localY) <= entity.height / 2;
}

function getRectPolygon(entity) {
  const radians = degToRad(entity.rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = entity.width / 2;
  const halfHeight = entity.height / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ];
  return corners.map(corner => ({
    x: entity.center.x + corner.x * cos - corner.y * sin,
    y: entity.center.y + corner.x * sin + corner.y * cos
  }));
}

function getAxesFromPolygon(polygon) {
  const axes = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const edge = { x: next.x - current.x, y: next.y - current.y };
    const length = Math.hypot(edge.x, edge.y);
    if (length === 0) continue;
    axes.push({ x: -edge.y / length, y: edge.x / length });
  }
  return axes;
}

function projectPolygon(axis, polygon) {
  let min = Infinity;
  let max = -Infinity;
  for (const point of polygon) {
    const projection = point.x * axis.x + point.y * axis.y;
    if (projection < min) min = projection;
    if (projection > max) max = projection;
  }
  return { min, max };
}

function overlapOnAxis(axis, polygonA, polygonB) {
  const projA = projectPolygon(axis, polygonA);
  const projB = projectPolygon(axis, polygonB);
  return projA.max >= projB.min && projB.max >= projA.min;
}

function rectanglesOverlap(rectA, rectB) {
  const polygonA = getRectPolygon(rectA);
  const polygonB = getRectPolygon(rectB);
  const axes = [...getAxesFromPolygon(polygonA), ...getAxesFromPolygon(polygonB)];
  return axes.every(axis => overlapOnAxis(axis, polygonA, polygonB));
}

function smallestAngleDelta(current, start) {
  let delta = current - start;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function isSlipbotPlacementValid(candidate, slipbots, ignoreId) {
  const { width, height, rotation } = candidate;
  const clamped = clampCenterToBounds(candidate.center, width, height, rotation);
  if (clamped.x !== candidate.center.x || clamped.y !== candidate.center.y) {
    return false;
  }
  const candidateRect = {
    center: candidate.center,
    width: candidate.width,
    height: candidate.height,
    rotation: candidate.rotation
  };
  for (const bot of slipbots) {
    if (bot.id === ignoreId) continue;
    const otherRect = {
      center: bot.center,
      width: bot.width,
      height: bot.height,
      rotation: bot.rotation
    };
    if (rectanglesOverlap(candidateRect, otherRect)) {
      return false;
    }
  }
  return true;
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const corner = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + corner, y);
  ctx.lineTo(x + width - corner, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + corner);
  ctx.lineTo(x + width, y + height - corner);
  ctx.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  ctx.lineTo(x + corner, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - corner);
  ctx.lineTo(x, y + corner);
  ctx.quadraticCurveTo(x, y, x + corner, y);
  ctx.closePath();
}

function buildInitialTrailer() {
  return {
    id: "trailer",
    center: { x: 36, y: GRID_HEIGHT - 26 },
    rotation: 0,
    width: TRAILER_WIDTH,
    height: TRAILER_LENGTH
  };
}

function buildInitialSlipbots(trailer) {
  return Array.from({ length: 3 }, (_, index) => {
    const color = SLIPBOT_COLORS[index % SLIPBOT_COLORS.length];
    const offset = -trailer.height / 2 + 8 + index * SLIPBOT_LENGTH + SLIPBOT_LENGTH / 2;
    return {
      id: `slipbot-${index + 1}`,
      name: `SlipBot ${String.fromCharCode(65 + index)}`,
      color,
      center: { x: trailer.center.x, y: trailer.center.y + offset },
      rotation: 0,
      width: SLIPBOT_WIDTH,
      height: SLIPBOT_LENGTH
    };
  });
}

function createSlipbot(id, color, center) {
  return {
    id,
    name: `SlipBot ${id.split("-").pop()?.toUpperCase() ?? id}`,
    color,
    center,
    rotation: 0,
    width: SLIPBOT_WIDTH,
    height: SLIPBOT_LENGTH
  };
}

function createParkingSlot(id, center) {
  return {
    id,
    center,
    rotation: 0,
    width: SLIPBOT_WIDTH,
    height: SLIPBOT_LENGTH
  };
}

function getPointerPosition(event, canvas) {
  const rect = canvas?.getBoundingClientRect();
  if (!rect) return null;
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;
  return {
    px,
    py,
    x: px / CELL_SIZE,
    y: py / CELL_SIZE
  };
}

function SimulatorV2() {
  const canvasRef = useRef(null);
  const interactionRef = useRef(null);

  const initialTrailerRef = useRef(buildInitialTrailer());

  const [trailer, setTrailer] = useState(() => ({ ...initialTrailerRef.current }));
  const [slipbots, setSlipbots] = useState(() => buildInitialSlipbots(initialTrailerRef.current));
  const [parkingSlots, setParkingSlots] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);

  const slipbotCounterRef = useRef(slipbots.length);
  const parkingCounterRef = useRef(0);

  const canvasDimensions = useMemo(
    () => ({ width: GRID_WIDTH * CELL_SIZE, height: GRID_HEIGHT * CELL_SIZE }),
    []
  );

  const selectionDetails = useMemo(() => {
    if (!selectedEntity) return null;
    if (selectedEntity.type === "trailer") {
      return {
        title: "Trailer",
        position: `(${trailer.center.x.toFixed(1)}, ${trailer.center.y.toFixed(1)})`,
        rotation: `${normalizeAngle(trailer.rotation).toFixed(1)}°`
      };
    }
    if (selectedEntity.type === "slipbot") {
      const bot = slipbots.find(item => item.id === selectedEntity.id);
      if (!bot) return null;
      return {
        title: bot.name,
        position: `(${bot.center.x.toFixed(1)}, ${bot.center.y.toFixed(1)})`,
        rotation: `${normalizeAngle(bot.rotation).toFixed(1)}°`
      };
    }
    const slot = parkingSlots.find(item => item.id === selectedEntity.id);
    if (!slot) return null;
    return {
      title: "Parking slot",
      position: `(${slot.center.x.toFixed(1)}, ${slot.center.y.toFixed(1)})`,
      rotation: `${normalizeAngle(slot.rotation).toFixed(1)}°`
    };
  }, [parkingSlots, selectedEntity, slipbots, trailer]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_WIDTH; x += 5) {
      const px = x * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_HEIGHT; y += 5) {
      const py = y * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
      ctx.stroke();
    }
    ctx.restore();

    parkingSlots.forEach(slot => {
      ctx.save();
      ctx.translate(slot.center.x * CELL_SIZE, slot.center.y * CELL_SIZE);
      ctx.rotate(degToRad(slot.rotation));
      const width = slot.width * CELL_SIZE;
      const height = slot.height * CELL_SIZE;
      drawRoundedRectPath(ctx, -width / 2, -height / 2, width, height, Math.min(width, height) * 0.12);
      ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
      ctx.fill();
      ctx.lineWidth = selectedEntity?.type === "parking" && selectedEntity.id === slot.id ? 3 : 1.6;
      ctx.strokeStyle = "rgba(94, 234, 212, 0.7)";
      ctx.setLineDash([10, 6]);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
    });

    ctx.save();
    ctx.translate(trailer.center.x * CELL_SIZE, trailer.center.y * CELL_SIZE);
    ctx.rotate(degToRad(trailer.rotation));
    const trailerWidth = trailer.width * CELL_SIZE;
    const trailerHeight = trailer.height * CELL_SIZE;
    drawRoundedRectPath(ctx, -trailerWidth / 2, -trailerHeight / 2, trailerWidth, trailerHeight, Math.min(trailerWidth, trailerHeight) * 0.08);
    ctx.fillStyle = "rgba(15, 118, 110, 0.35)";
    ctx.fill();
    ctx.lineWidth = selectedEntity?.type === "trailer" ? 3 : 1.6;
    ctx.strokeStyle = "rgba(45, 212, 191, 0.9)";
    ctx.stroke();
    ctx.restore();

    slipbots.forEach(bot => {
      const isSelected = selectedEntity?.type === "slipbot" && selectedEntity.id === bot.id;
      ctx.save();
      ctx.translate(bot.center.x * CELL_SIZE, bot.center.y * CELL_SIZE);
      ctx.rotate(degToRad(bot.rotation));
      const width = bot.width * CELL_SIZE;
      const height = bot.height * CELL_SIZE;
      drawRoundedRectPath(ctx, -width / 2, -height / 2, width, height, Math.min(width, height) * 0.18);
      ctx.fillStyle = bot.color;
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1.4;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.8)";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -height / 2 + 6);
      ctx.lineTo(0, -height / 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
      ctx.stroke();
      ctx.restore();
    });
  }, [parkingSlots, selectedEntity, slipbots, trailer]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  const hitTest = useCallback(
    pointer => {
      if (!pointer) return null;
      const gridPoint = { x: pointer.x, y: pointer.y };

      for (let i = slipbots.length - 1; i >= 0; i -= 1) {
        const bot = slipbots[i];
        if (pointInRectangle(bot, gridPoint)) {
          return { type: "slipbot", id: bot.id };
        }
      }

      for (let i = parkingSlots.length - 1; i >= 0; i -= 1) {
        const slot = parkingSlots[i];
        if (pointInRectangle(slot, gridPoint)) {
          return { type: "parking", id: slot.id };
        }
      }

      if (pointInRectangle(trailer, gridPoint)) {
        return { type: "trailer", id: trailer.id };
      }
      return null;
    },
    [parkingSlots, slipbots, trailer]
  );

  const handlePointerDown = useCallback(
    event => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pointer = getPointerPosition(event, canvas);
      const hit = hitTest(pointer);
      if (!hit) {
        setSelectedEntity(null);
        return;
      }

      event.preventDefault();
      setSelectedEntity({ type: hit.type, id: hit.id });

      const entity =
        hit.type === "trailer"
          ? trailer
          : hit.type === "slipbot"
          ? slipbots.find(item => item.id === hit.id) ?? null
          : parkingSlots.find(item => item.id === hit.id) ?? null;
      if (!entity) return;

      if (canvas.setPointerCapture) {
        canvas.setPointerCapture(event.pointerId);
      }

      const rotateGesture = event.shiftKey || event.button === 2 || event.buttons === 2;
      if (rotateGesture) {
        const centerPx = {
          x: entity.center.x * CELL_SIZE,
          y: entity.center.y * CELL_SIZE
        };
        const angle = radToDeg(Math.atan2(pointer.py - centerPx.y, pointer.px - centerPx.x));
        interactionRef.current = {
          pointerId: event.pointerId,
          mode: "rotate",
          entityType: hit.type,
          id: hit.id,
          startAngle: angle,
          startRotation: entity.rotation
        };
      } else {
        const radians = degToRad(entity.rotation);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const dx = pointer.x - entity.center.x;
        const dy = pointer.y - entity.center.y;
        const offsetLocal = {
          x: cos * dx + sin * dy,
          y: -sin * dx + cos * dy
        };
        interactionRef.current = {
          pointerId: event.pointerId,
          mode: "drag",
          entityType: hit.type,
          id: hit.id,
          offsetLocal
        };
      }
    },
    [hitTest, parkingSlots, slipbots, trailer]
  );

  const handlePointerMove = useCallback(
    event => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.pointerId !== event.pointerId) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pointer = getPointerPosition(event, canvas);
      if (!pointer) return;
      event.preventDefault();

      if (interaction.mode === "drag") {
        if (interaction.entityType === "trailer") {
          setTrailer(prev => {
            const radians = degToRad(prev.rotation);
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            const offsetLocal = interaction.offsetLocal ?? { x: 0, y: 0 };
            const worldOffset = {
              x: cos * offsetLocal.x - sin * offsetLocal.y,
              y: sin * offsetLocal.x + cos * offsetLocal.y
            };
            let candidateCenter = {
              x: pointer.x - worldOffset.x,
              y: pointer.y - worldOffset.y
            };
            candidateCenter = clampCenterToBounds(candidateCenter, prev.width, prev.height, prev.rotation);
            return { ...prev, center: candidateCenter };
          });
          return;
        }
        if (interaction.entityType === "slipbot") {
          setSlipbots(prev => {
            const index = prev.findIndex(item => item.id === interaction.id);
            if (index === -1) return prev;
            const bot = prev[index];
            const radians = degToRad(bot.rotation);
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            const offsetLocal = interaction.offsetLocal ?? { x: 0, y: 0 };
            const worldOffset = {
              x: cos * offsetLocal.x - sin * offsetLocal.y,
              y: sin * offsetLocal.x + cos * offsetLocal.y
            };
            let candidateCenter = {
              x: pointer.x - worldOffset.x,
              y: pointer.y - worldOffset.y
            };
            candidateCenter = clampCenterToBounds(candidateCenter, bot.width, bot.height, bot.rotation);
            const candidate = { ...bot, center: candidateCenter };
            if (!isSlipbotPlacementValid(candidate, prev, bot.id)) {
              return prev;
            }
            const next = [...prev];
            next[index] = candidate;
            return next;
          });
          return;
        }
        if (interaction.entityType === "parking") {
          setParkingSlots(prev => {
            const index = prev.findIndex(item => item.id === interaction.id);
            if (index === -1) return prev;
            const slot = prev[index];
            const radians = degToRad(slot.rotation);
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            const offsetLocal = interaction.offsetLocal ?? { x: 0, y: 0 };
            const worldOffset = {
              x: cos * offsetLocal.x - sin * offsetLocal.y,
              y: sin * offsetLocal.x + cos * offsetLocal.y
            };
            let candidateCenter = {
              x: pointer.x - worldOffset.x,
              y: pointer.y - worldOffset.y
            };
            candidateCenter = clampCenterToBounds(candidateCenter, slot.width, slot.height, slot.rotation);
            const next = [...prev];
            next[index] = { ...slot, center: candidateCenter };
            return next;
          });
        }
        return;
      }

      if (interaction.mode === "rotate") {
        if (interaction.entityType === "trailer") {
          const centerPx = {
            x: trailer.center.x * CELL_SIZE,
            y: trailer.center.y * CELL_SIZE
          };
          const angle = radToDeg(Math.atan2(pointer.py - centerPx.y, pointer.px - centerPx.x));
          const delta = smallestAngleDelta(angle, interaction.startAngle ?? angle);
          const rotation = normalizeAngle((interaction.startRotation ?? trailer.rotation) + delta);
          setTrailer(prev => ({ ...prev, rotation }));
          return;
        }
        if (interaction.entityType === "slipbot") {
          const bot = slipbots.find(item => item.id === interaction.id);
          if (!bot) return;
          const centerPx = {
            x: bot.center.x * CELL_SIZE,
            y: bot.center.y * CELL_SIZE
          };
          const angle = radToDeg(Math.atan2(pointer.py - centerPx.y, pointer.px - centerPx.x));
          const delta = smallestAngleDelta(angle, interaction.startAngle ?? angle);
          const rotation = normalizeAngle((interaction.startRotation ?? bot.rotation) + delta);
          setSlipbots(prev => {
            const index = prev.findIndex(item => item.id === interaction.id);
            if (index === -1) return prev;
            const candidate = { ...prev[index], rotation };
            if (!isSlipbotPlacementValid(candidate, prev, candidate.id)) {
              return prev;
            }
            const next = [...prev];
            next[index] = candidate;
            return next;
          });
          return;
        }
        if (interaction.entityType === "parking") {
          const slot = parkingSlots.find(item => item.id === interaction.id);
          if (!slot) return;
          const centerPx = {
            x: slot.center.x * CELL_SIZE,
            y: slot.center.y * CELL_SIZE
          };
          const angle = radToDeg(Math.atan2(pointer.py - centerPx.y, pointer.px - centerPx.x));
          const delta = smallestAngleDelta(angle, interaction.startAngle ?? angle);
          const rotation = normalizeAngle((interaction.startRotation ?? slot.rotation) + delta);
          setParkingSlots(prev => {
            const index = prev.findIndex(item => item.id === interaction.id);
            if (index === -1) return prev;
            const next = [...prev];
            next[index] = { ...prev[index], rotation };
            return next;
          });
        }
      }
    },
    [parkingSlots, slipbots, trailer]
  );

  const handlePointerUp = useCallback(event => {
    const canvas = canvasRef.current;
    if (canvas && canvas.releasePointerCapture && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    interactionRef.current = null;
  }, []);

  const placeNewSlipbot = useCallback(() => {
    const baseCenter = { x: GRID_WIDTH / 2, y: GRID_HEIGHT / 2 };
    const candidates = [];
    const step = 8;
    for (let radius = 0; radius <= 40; radius += step) {
      for (let angle = 0; angle < 360; angle += 45) {
        const radians = degToRad(angle);
        candidates.push({
          x: baseCenter.x + Math.cos(radians) * radius,
          y: baseCenter.y + Math.sin(radians) * radius
        });
      }
    }
    for (const candidate of candidates) {
      const center = clampCenterToBounds({ ...candidate }, SLIPBOT_WIDTH, SLIPBOT_LENGTH, 0);
      const slipbotCandidate = {
        id: "candidate",
        center,
        width: SLIPBOT_WIDTH,
        height: SLIPBOT_LENGTH,
        rotation: 0
      };
      if (isSlipbotPlacementValid(slipbotCandidate, slipbots, null)) {
        return center;
      }
    }
    return clampCenterToBounds(baseCenter, SLIPBOT_WIDTH, SLIPBOT_LENGTH, 0);
  }, [slipbots]);

  const handleAddSlipbot = useCallback(() => {
    slipbotCounterRef.current += 1;
    const id = `slipbot-${slipbotCounterRef.current}`;
    const color = SLIPBOT_COLORS[(slipbotCounterRef.current - 1) % SLIPBOT_COLORS.length];
    const center = placeNewSlipbot();
    const newSlipbot = createSlipbot(id, color, center);
    setSlipbots(prev => [...prev, newSlipbot]);
    setSelectedEntity({ type: "slipbot", id });
  }, [placeNewSlipbot]);

  const handleAddParkingSlot = useCallback(() => {
    parkingCounterRef.current += 1;
    const id = `slot-${parkingCounterRef.current}`;
    const offset = {
      x: trailer.center.x + trailer.width + 12,
      y: trailer.center.y - trailer.height / 2 - SLIPBOT_LENGTH
    };
    const center = clampCenterToBounds(offset, SLIPBOT_WIDTH, SLIPBOT_LENGTH, 0);
    const slot = createParkingSlot(id, center);
    setParkingSlots(prev => [...prev, slot]);
    setSelectedEntity({ type: "parking", id });
  }, [trailer.center.x, trailer.center.y, trailer.height, trailer.width]);

  const handleReset = useCallback(() => {
    const freshTrailer = buildInitialTrailer();
    initialTrailerRef.current = freshTrailer;
    slipbotCounterRef.current = 3;
    parkingCounterRef.current = 0;
    setTrailer({ ...freshTrailer });
    setSlipbots(buildInitialSlipbots(freshTrailer));
    setParkingSlots([]);
    setSelectedEntity(null);
  }, []);

  return (
    <div className="simulator-app">
      <header className="simulator-header">
        <h1>SlipBot Layout Sandbox</h1>
        <p>
          Drag any asset to move it. Hold <strong>Shift</strong> (or use the right mouse button) while
          dragging to rotate with precise 360° control. Everything stays locked to your cursor so
          adjustments feel seamless.
        </p>
      </header>
      <div className="simulator-layout">
        <div className="canvas-wrapper">
          <canvas
            ref={canvasRef}
            className="simulator-canvas"
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={event => event.preventDefault()}
          />
        </div>
        <aside className="simulator-panel">
          <div className="panel-section">
            <h2>Controls</h2>
            <p>
              Every asset behaves like an obstacle. Drag to move, or hold Shift/right click while
              dragging to rotate smoothly.
            </p>
          </div>
          <div className="panel-section buttons">
            <button type="button" className="panel-button" onClick={handleAddSlipbot}>
              Add SlipBot
            </button>
            <button type="button" className="panel-button" onClick={handleAddParkingSlot}>
              Add parking slot
            </button>
            <button type="button" className="panel-button subtle" onClick={handleReset}>
              Reset layout
            </button>
          </div>
          <div className="panel-section">
            <h3>Summary</h3>
            <ul className="summary-list">
              <li>
                <span>SlipBots</span>
                <span>{slipbots.length}</span>
              </li>
              <li>
                <span>Parking slots</span>
                <span>{parkingSlots.length}</span>
              </li>
            </ul>
          </div>
          {selectionDetails && (
            <div className="panel-section">
              <h3>Selected</h3>
              <p className="selection-title">{selectionDetails.title}</p>
              <p className="selection-detail">Position: {selectionDetails.position}</p>
              <p className="selection-detail">Rotation: {selectionDetails.rotation}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default SimulatorV2;
