import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./SimulatorV2.css";

const GRID_WIDTH = 200;
const GRID_HEIGHT = 100;
const CELL_SIZE = 6;

const SLIPBOT_LENGTH = 17;
const SLIPBOT_WIDTH = 8;
const TRAILER_LENGTH = SLIPBOT_LENGTH * 3 + 6;
const TRAILER_WIDTH = SLIPBOT_WIDTH + 6;
const TRAILER_WALL_THICKNESS = 4;
const TRAILER_OPENING_WIDTH = SLIPBOT_WIDTH + 4;

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

const RIGHT_ANGLE_ORIENTATIONS = [0, 90, 180, 270];
const ROUTE_GRID_SCALE = 2; // represents half-cell precision

function alignToRightAngle(angle) {
  const normalized = normalizeAngle(angle);
  let best = RIGHT_ANGLE_ORIENTATIONS[0];
  let smallest = Infinity;
  RIGHT_ANGLE_ORIENTATIONS.forEach(candidate => {
    const diff = Math.abs(smallestAngleDelta(normalized, candidate));
    if (diff < smallest) {
      smallest = diff;
      best = candidate;
    }
  });
  return best;
}

function orientationIndexFromAngle(angle) {
  const normalized = alignToRightAngle(angle);
  return RIGHT_ANGLE_ORIENTATIONS.indexOf(normalized);
}

function angleFromOrientationIndex(index) {
  return RIGHT_ANGLE_ORIENTATIONS[((index % RIGHT_ANGLE_ORIENTATIONS.length) + RIGHT_ANGLE_ORIENTATIONS.length) % RIGHT_ANGLE_ORIENTATIONS.length];
}

function encodeRouteKey(x, y, orientationIndex) {
  return `${x},${y},${orientationIndex}`;
}

function isPlacementCollisionFree(candidate, obstacles) {
  const clamped = clampCenterToBounds(candidate.center, candidate.width, candidate.height, candidate.rotation);
  if (clamped.x !== candidate.center.x || clamped.y !== candidate.center.y) {
    return false;
  }
  for (const obstacle of obstacles) {
    if (rectanglesOverlap(candidate, obstacle)) {
      return false;
    }
  }
  return true;
}

function planRoute(start, goal, width, height, obstacles) {
  const startX = Math.round(start.center.x * ROUTE_GRID_SCALE);
  const startY = Math.round(start.center.y * ROUTE_GRID_SCALE);
  const goalX = Math.round(goal.center.x * ROUTE_GRID_SCALE);
  const goalY = Math.round(goal.center.y * ROUTE_GRID_SCALE);
  const startOrientation = orientationIndexFromAngle(start.rotation);
  const goalOrientation = orientationIndexFromAngle(goal.rotation);

  const startState = { x: startX, y: startY, orientationIndex: startOrientation };
  const goalKey = encodeRouteKey(goalX, goalY, goalOrientation);

  const open = [];
  const gScores = new Map();
  const cameFrom = new Map();
  const visited = new Set();

  function heuristic(x, y, orientationIndex) {
    const distance = Math.abs(x - goalX) + Math.abs(y - goalY);
    const orientationDelta = Math.abs(orientationIndex - goalOrientation);
    const rotationCost = Math.min(orientationDelta, RIGHT_ANGLE_ORIENTATIONS.length - orientationDelta);
    return distance + rotationCost * 2;
  }

  function pushNode(node) {
    const index = open.findIndex(item => item.fScore > node.fScore);
    if (index === -1) {
      open.push(node);
    } else {
      open.splice(index, 0, node);
    }
  }

  const startKey = encodeRouteKey(startState.x, startState.y, startState.orientationIndex);
  gScores.set(startKey, 0);
  pushNode({ ...startState, fScore: heuristic(startState.x, startState.y, startState.orientationIndex) });

  const directionVectors = [
    { dx: ROUTE_GRID_SCALE, dy: 0 },
    { dx: 0, dy: ROUTE_GRID_SCALE },
    { dx: -ROUTE_GRID_SCALE, dy: 0 },
    { dx: 0, dy: -ROUTE_GRID_SCALE }
  ];

  while (open.length > 0) {
    const current = open.shift();
    const currentKey = encodeRouteKey(current.x, current.y, current.orientationIndex);
    if (visited.has(currentKey)) {
      continue;
    }
    visited.add(currentKey);

    if (currentKey === goalKey) {
      const path = [];
      let nodeKey = currentKey;
      let node = current;
      while (node) {
        path.push(node);
        const previousKey = cameFrom.get(nodeKey);
        if (!previousKey) break;
        node = previousKey.node;
        nodeKey = previousKey.key;
      }
      return path.reverse();
    }

    const baseScore = gScores.get(currentKey) ?? Infinity;

    // rotate left/right
    for (const delta of [-1, 1]) {
      const nextOrientation = (current.orientationIndex + delta + RIGHT_ANGLE_ORIENTATIONS.length) % RIGHT_ANGLE_ORIENTATIONS.length;
      const nextKey = encodeRouteKey(current.x, current.y, nextOrientation);
      const nextScore = baseScore + 2;
      if (nextScore >= (gScores.get(nextKey) ?? Infinity)) continue;
      const candidate = {
        center: { x: current.x / ROUTE_GRID_SCALE, y: current.y / ROUTE_GRID_SCALE },
        width,
        height,
        rotation: angleFromOrientationIndex(nextOrientation)
      };
      if (!isPlacementCollisionFree(candidate, obstacles)) continue;
      cameFrom.set(nextKey, { key: currentKey, node: current });
      gScores.set(nextKey, nextScore);
      pushNode({ x: current.x, y: current.y, orientationIndex: nextOrientation, fScore: nextScore + heuristic(current.x, current.y, nextOrientation) });
    }

    // move forward/backward
    const direction = directionVectors[current.orientationIndex];
    for (const directionMultiplier of [1, -1]) {
      const nextX = current.x + direction.dx * directionMultiplier;
      const nextY = current.y + direction.dy * directionMultiplier;
      const nextKey = encodeRouteKey(nextX, nextY, current.orientationIndex);
      const nextScore = baseScore + 1;
      if (nextScore >= (gScores.get(nextKey) ?? Infinity)) continue;
      const candidate = {
        center: { x: nextX / ROUTE_GRID_SCALE, y: nextY / ROUTE_GRID_SCALE },
        width,
        height,
        rotation: angleFromOrientationIndex(current.orientationIndex)
      };
      if (!isPlacementCollisionFree(candidate, obstacles)) continue;
      cameFrom.set(nextKey, { key: currentKey, node: current });
      gScores.set(nextKey, nextScore);
      pushNode({ x: nextX, y: nextY, orientationIndex: current.orientationIndex, fScore: nextScore + heuristic(nextX, nextY, current.orientationIndex) });
    }
  }

  return null;
}

function buildFramesFromPath(path, startRotation, goalRotation) {
  if (!path || path.length === 0) return [];
  const frames = [];
  const normalizedStart = normalizeAngle(startRotation);
  const initialState = path[0];
  const initialAngle = angleFromOrientationIndex(initialState.orientationIndex);
  const initialCenter = {
    x: initialState.x / ROUTE_GRID_SCALE,
    y: initialState.y / ROUTE_GRID_SCALE
  };
  if (Math.abs(smallestAngleDelta(initialAngle, normalizedStart)) > 1) {
    frames.push({ center: initialCenter, rotation: initialAngle });
  }
  for (let i = 1; i < path.length; i += 1) {
    const state = path[i];
    frames.push({
      center: { x: state.x / ROUTE_GRID_SCALE, y: state.y / ROUTE_GRID_SCALE },
      rotation: angleFromOrientationIndex(state.orientationIndex)
    });
  }
  const goalState = path[path.length - 1];
  const lastFrameRotation = frames.length
    ? frames[frames.length - 1].rotation
    : angleFromOrientationIndex(goalState.orientationIndex);
  const desiredGoalRotation = normalizeAngle(goalRotation);
  if (Math.abs(smallestAngleDelta(desiredGoalRotation, lastFrameRotation)) > 1) {
    frames.push({
      center: { x: goalState.x / ROUTE_GRID_SCALE, y: goalState.y / ROUTE_GRID_SCALE },
      rotation: desiredGoalRotation
    });
  }
  return frames.reduce((acc, frame) => {
    const previous = acc[acc.length - 1];
    if (
      previous &&
      Math.abs(previous.center.x - frame.center.x) < 1e-3 &&
      Math.abs(previous.center.y - frame.center.y) < 1e-3 &&
      Math.abs(smallestAngleDelta(previous.rotation, frame.rotation)) < 0.5
    ) {
      return acc;
    }
    acc.push(frame);
    return acc;
  }, []);
}

function buildPlanningObstacles(slipbots, parkingSlots, movingBotId, allowedParkingId) {
  const obstacles = [];
  slipbots.forEach(bot => {
    if (bot.id === movingBotId) return;
    obstacles.push({
      center: { ...bot.center },
      width: bot.width,
      height: bot.height,
      rotation: bot.rotation
    });
  });
  parkingSlots.forEach(slot => {
    if (slot.id === allowedParkingId) return;
    obstacles.push({
      center: { ...slot.center },
      width: slot.width,
      height: slot.height,
      rotation: slot.rotation
    });
  });
  return obstacles;
}

function planSlipbotMovement(bot, goal, slipbots, parkingSlots, options = {}) {
  const obstacles = buildPlanningObstacles(
    slipbots,
    parkingSlots,
    bot.id,
    options.allowedParkingId ?? null
  );
  if (options.includeTrailer && options.trailer) {
    obstacles.push(...buildTrailerWallObstacles(options.trailer));
  }
  const route = planRoute(
    { center: bot.center, rotation: bot.rotation },
    { center: goal.center, rotation: goal.rotation },
    bot.width,
    bot.height,
    obstacles
  );
  if (!route) return null;
  const frames = buildFramesFromPath(route, bot.rotation, goal.rotation);
  const points = route.map(state => ({
    x: state.x / ROUTE_GRID_SCALE,
    y: state.y / ROUTE_GRID_SCALE
  }));
  return { frames, points };
}

function extractSlipbotLabel(bot) {
  const match = bot.name?.match(/([A-Z])$/i);
  return match ? match[1].toUpperCase() : null;
}

function buildParkingSlotLookup(parkingSlots) {
  const lookup = {};
  parkingSlots.forEach((slot, index) => {
    const derivedLabel = slot.label
      ? slot.label.toUpperCase()
      : String.fromCharCode(65 + (index % 26));
    if (!lookup[derivedLabel]) {
      lookup[derivedLabel] = slot;
    }
  });
  return lookup;
}

function computeTrailerSlots(trailer) {
  const radians = degToRad(trailer.rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return Array.from({ length: 3 }, (_, index) => {
    const offset = -trailer.height / 2 + 8 + index * SLIPBOT_LENGTH + SLIPBOT_LENGTH / 2;
    const local = { x: 0, y: offset };
    return {
      label: String.fromCharCode(65 + index),
      center: {
        x: trailer.center.x + local.x * cos - local.y * sin,
        y: trailer.center.y + local.x * sin + local.y * cos
      },
      rotation: trailer.rotation
    };
  });
}

function transformTrailerLocalPoint(trailer, local) {
  const radians = degToRad(trailer.rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: trailer.center.x + local.x * cos - local.y * sin,
    y: trailer.center.y + local.x * sin + local.y * cos
  };
}

function buildTrailerWallObstacles(trailer) {
  const halfWidth = trailer.width / 2;
  const halfHeight = trailer.height / 2;
  const maxThicknessForSlipbot = Math.max(0, (trailer.width - SLIPBOT_WIDTH) / 2);
  const wallThickness = Math.min(
    TRAILER_WALL_THICKNESS,
    halfWidth,
    halfHeight,
    maxThicknessForSlipbot
  );
  const openingHalfWidth = Math.min(TRAILER_OPENING_WIDTH / 2, halfWidth);
  const walls = [];

  const sideWallWidth = wallThickness;
  const sideWallHeight = trailer.height;
  const sideOffsets = [
    { x: -(halfWidth - wallThickness / 2), y: 0 },
    { x: halfWidth - wallThickness / 2, y: 0 }
  ];
  sideOffsets.forEach(offset => {
    walls.push({
      center: transformTrailerLocalPoint(trailer, offset),
      width: sideWallWidth,
      height: sideWallHeight,
      rotation: trailer.rotation
    });
  });

  walls.push({
    center: transformTrailerLocalPoint(trailer, { x: 0, y: -(halfHeight - wallThickness / 2) }),
    width: trailer.width,
    height: wallThickness,
    rotation: trailer.rotation
  });

  const remainingWidth = halfWidth - openingHalfWidth;
  if (remainingWidth > 0.5) {
    const segmentWidth = remainingWidth * 2;
    const segmentY = halfHeight - wallThickness / 2;
    const segmentXOffsets = [
      -(openingHalfWidth + remainingWidth / 2),
      openingHalfWidth + remainingWidth / 2
    ];
    segmentXOffsets.forEach(xOffset => {
      walls.push({
        center: transformTrailerLocalPoint(trailer, { x: xOffset, y: segmentY }),
        width: segmentWidth,
        height: wallThickness,
        rotation: trailer.rotation
      });
    });
  }

  return walls;
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

function createParkingSlot(id, center, label) {
  return {
    id,
    center,
    rotation: 0,
    width: SLIPBOT_WIDTH,
    height: SLIPBOT_LENGTH,
    label
  };
}

function getPointerPosition(event, canvas) {
  const rect = canvas?.getBoundingClientRect();
  if (!rect) return null;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;
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
  const [plannedRoutes, setPlannedRoutes] = useState({});
  const [isAnimatingState, setIsAnimatingState] = useState(false);

  const slipbotCounterRef = useRef(slipbots.length);
  const parkingCounterRef = useRef(0);
  const animationHandlesRef = useRef([]);
  const isAnimatingRef = useRef(false);

  const clearAnimations = useCallback(() => {
    animationHandlesRef.current.forEach(handle => {
      window.clearTimeout(handle);
    });
    animationHandlesRef.current = [];
    isAnimatingRef.current = false;
    setIsAnimatingState(false);
  }, []);

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
      if (slot.label) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        ctx.font = `bold ${Math.max(12, CELL_SIZE * 2.4)}px 'Inter', 'Segoe UI', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(slot.label, 0, 0);
      }
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

    Object.entries(plannedRoutes).forEach(([botId, route]) => {
      if (!route?.points?.length) return;
      const bot = slipbots.find(item => item.id === botId);
      ctx.save();
      ctx.strokeStyle = bot?.color ? `${bot.color}AA` : "rgba(248, 250, 252, 0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      route.points.forEach((point, index) => {
        const px = point.x * CELL_SIZE;
        const py = point.y * CELL_SIZE;
        if (index === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });
  }, [parkingSlots, plannedRoutes, selectedEntity, slipbots, trailer]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  useEffect(() => {
    return () => {
      clearAnimations();
    };
  }, [clearAnimations]);

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
          const previousTrailer = trailer;
          let translation = { x: 0, y: 0 };
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
            translation = {
              x: candidateCenter.x - prev.center.x,
              y: candidateCenter.y - prev.center.y
            };
            if (Math.abs(translation.x) < 1e-6 && Math.abs(translation.y) < 1e-6) {
              translation = { x: 0, y: 0 };
              return prev;
            }
            return { ...prev, center: candidateCenter };
          });
          if (Math.abs(translation.x) > 0 || Math.abs(translation.y) > 0) {
            setSlipbots(prev =>
              prev.map(bot =>
                pointInRectangle(previousTrailer, bot.center)
                  ? {
                      ...bot,
                      center: {
                        x: bot.center.x + translation.x,
                        y: bot.center.y + translation.y
                      }
                    }
                  : bot
              )
            );
          }
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
    const labelIndex = (parkingCounterRef.current - 1) % 26;
    const label = String.fromCharCode(65 + labelIndex);
    const offset = {
      x: trailer.center.x + trailer.width + 12,
      y: trailer.center.y - trailer.height / 2 - SLIPBOT_LENGTH
    };
    const center = clampCenterToBounds(offset, SLIPBOT_WIDTH, SLIPBOT_LENGTH, 0);
    const slot = createParkingSlot(id, center, label);
    setParkingSlots(prev => [...prev, slot]);
    setSelectedEntity({ type: "parking", id });
  }, [trailer.center.x, trailer.center.y, trailer.height, trailer.width]);

  const animatePlans = useCallback(
    (plans, onComplete) => {
      clearAnimations();
      if (!plans.length) {
        isAnimatingRef.current = false;
        setIsAnimatingState(false);
        if (onComplete) onComplete();
        return;
      }

      const runPlan = index => {
        if (index >= plans.length) {
          isAnimatingRef.current = false;
          setIsAnimatingState(false);
          if (onComplete) onComplete();
          return;
        }
        const currentPlan = plans[index];
        const frames = currentPlan.frames ?? [];
        if (frames.length === 0) {
          runPlan(index + 1);
          return;
        }

        let frameIndex = 0;
        const applyNextFrame = () => {
          if (frameIndex >= frames.length) {
            runPlan(index + 1);
            return;
          }
          const frame = frames[frameIndex];
          setSlipbots(prev => {
            const next = [...prev];
            const botIndex = next.findIndex(item => item.id === currentPlan.botId);
            if (botIndex === -1) return prev;
            next[botIndex] = {
              ...next[botIndex],
              center: frame.center,
              rotation: frame.rotation
            };
            return next;
          });
          frameIndex += 1;
          const handle = window.setTimeout(applyNextFrame, 120);
          animationHandlesRef.current.push(handle);
        };

        applyNextFrame();
      };

      isAnimatingRef.current = true;
      setIsAnimatingState(true);
      runPlan(0);
    },
    [clearAnimations]
  );

  const handleExitToParking = useCallback(() => {
    if (!parkingSlots.length) {
      setPlannedRoutes({});
      return;
    }
    const slotLookup = buildParkingSlotLookup(parkingSlots);
    const trailerBots = slipbots
      .filter(bot => pointInRectangle(trailer, bot.center))
      .map(bot => ({ bot, label: extractSlipbotLabel(bot) }))
      .filter(item => item.label && slotLookup[item.label]);
    if (!trailerBots.length) {
      setPlannedRoutes({});
      return;
    }
    trailerBots.sort((a, b) => a.label.localeCompare(b.label));

    let simulatedSlipbots = slipbots.map(item => ({ ...item }));
    const plans = [];
    const targets = {};

    trailerBots.forEach(({ bot, label }) => {
      const slot = slotLookup[label];
      if (!slot) return;
      const simulatedBot = simulatedSlipbots.find(item => item.id === bot.id) ?? bot;
      const movement = planSlipbotMovement(
        simulatedBot,
        { center: { ...slot.center }, rotation: slot.rotation },
        simulatedSlipbots,
        parkingSlots,
        {
          allowedParkingId: slot.id,
          includeTrailer: true,
          trailer
        }
      );
      if (!movement) return;
      plans.push({ botId: bot.id, frames: movement.frames, points: movement.points });
      targets[bot.id] = { center: { ...slot.center }, rotation: slot.rotation };
      simulatedSlipbots = simulatedSlipbots.map(item =>
        item.id === bot.id
          ? { ...item, center: { ...slot.center }, rotation: slot.rotation }
          : item
      );
    });

    if (!plans.length) {
      setPlannedRoutes({});
      return;
    }

    const routes = plans.reduce((acc, plan) => {
      const bot = slipbots.find(item => item.id === plan.botId);
      acc[plan.botId] = { points: plan.points, color: bot?.color ?? null };
      return acc;
    }, {});
    setPlannedRoutes(routes);

    animatePlans(plans, () => {
      setSlipbots(prev =>
        prev.map(bot => {
          const target = targets[bot.id];
          return target ? { ...bot, center: target.center, rotation: target.rotation } : bot;
        })
      );
    });
  }, [animatePlans, parkingSlots, slipbots, trailer]);

  const handleEnterTrailer = useCallback(() => {
    const trailerSlots = computeTrailerSlots(trailer);
    const slotLookup = trailerSlots.reduce((acc, slot) => {
      acc[slot.label] = slot;
      return acc;
    }, {});

    const stagedBots = slipbots
      .filter(bot => !pointInRectangle(trailer, bot.center))
      .map(bot => ({ bot, label: extractSlipbotLabel(bot) }))
      .filter(item => item.label && slotLookup[item.label])
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, trailerSlots.length);

    if (!stagedBots.length) {
      setPlannedRoutes({});
      return;
    }

    let simulatedSlipbots = slipbots.map(item => ({ ...item }));
    const plans = [];
    const targets = {};

    stagedBots.forEach(({ bot, label }) => {
      const slot = slotLookup[label];
      if (!slot) return;
      const simulatedBot = simulatedSlipbots.find(item => item.id === bot.id) ?? bot;
      const movement = planSlipbotMovement(
        simulatedBot,
        { center: { ...slot.center }, rotation: slot.rotation },
        simulatedSlipbots,
        parkingSlots,
        {
          allowedParkingId: null,
          includeTrailer: true,
          trailer
        }
      );
      if (!movement) return;
      plans.push({ botId: bot.id, frames: movement.frames, points: movement.points });
      targets[bot.id] = { center: { ...slot.center }, rotation: slot.rotation };
      simulatedSlipbots = simulatedSlipbots.map(item =>
        item.id === bot.id
          ? { ...item, center: { ...slot.center }, rotation: slot.rotation }
          : item
      );
    });

    if (!plans.length) {
      setPlannedRoutes({});
      return;
    }

    const routes = plans.reduce((acc, plan) => {
      const bot = slipbots.find(item => item.id === plan.botId);
      acc[plan.botId] = { points: plan.points, color: bot?.color ?? null };
      return acc;
    }, {});
    setPlannedRoutes(routes);

    animatePlans(plans, () => {
      setSlipbots(prev =>
        prev.map(bot => {
          const target = targets[bot.id];
          return target ? { ...bot, center: target.center, rotation: target.rotation } : bot;
        })
      );
    });
  }, [animatePlans, parkingSlots, slipbots, trailer]);

  const handleReset = useCallback(() => {
    const freshTrailer = buildInitialTrailer();
    initialTrailerRef.current = freshTrailer;
    slipbotCounterRef.current = 3;
    parkingCounterRef.current = 0;
    clearAnimations();
    setTrailer({ ...freshTrailer });
    setSlipbots(buildInitialSlipbots(freshTrailer));
    setParkingSlots([]);
    setSelectedEntity(null);
    setPlannedRoutes({});
  }, [clearAnimations]);

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
              dragging to rotate smoothly. Use the Exit/Enter trailer actions to generate collision-free
              routes for the staged SlipBots.
            </p>
          </div>
          <div className="panel-section buttons">
            <button
              type="button"
              className="panel-button"
              onClick={handleExitToParking}
              disabled={isAnimatingState}
            >
              Exit trailer
            </button>
            <button
              type="button"
              className="panel-button"
              onClick={handleEnterTrailer}
              disabled={isAnimatingState}
            >
              Enter trailer
            </button>
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
