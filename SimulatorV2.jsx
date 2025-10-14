import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./SimulatorV2.css";

const GRID_WIDTH = 200;
const GRID_HEIGHT = 100;
const CELL_SIZE = 6;
const SLIPBOT_WIDTH = 8;
const SLIPBOT_HEIGHT = 17;
const SLIPBOT_SPEED_FTPS = 6;
const SLIPBOT_ROTATION_SPEED_DEG = 180;

const SLIPBOT_COUNT = 3;

const ORIENTATION_SEQUENCE = ["north", "east", "south", "west"];

const ORIENTATION_CONFIG = {
  north: {
    width: SLIPBOT_WIDTH,
    height: SLIPBOT_HEIGHT,
    exitVector: { x: 0, y: -1 },
    exitSteps: SLIPBOT_HEIGHT,
    botOffset(index) {
      return { x: 0, y: index * SLIPBOT_HEIGHT };
    },
    trailerSize: {
      width: SLIPBOT_WIDTH,
      height: SLIPBOT_HEIGHT * SLIPBOT_COUNT
    }
  },
  east: {
    width: SLIPBOT_HEIGHT,
    height: SLIPBOT_WIDTH,
    exitVector: { x: 1, y: 0 },
    exitSteps: SLIPBOT_HEIGHT,
    botOffset(index) {
      return { x: (SLIPBOT_COUNT - index - 1) * SLIPBOT_HEIGHT, y: 0 };
    },
    trailerSize: {
      width: SLIPBOT_HEIGHT * SLIPBOT_COUNT,
      height: SLIPBOT_WIDTH
    }
  },
  south: {
    width: SLIPBOT_WIDTH,
    height: SLIPBOT_HEIGHT,
    exitVector: { x: 0, y: 1 },
    exitSteps: SLIPBOT_HEIGHT,
    botOffset(index) {
      return { x: 0, y: (SLIPBOT_COUNT - index - 1) * SLIPBOT_HEIGHT };
    },
    trailerSize: {
      width: SLIPBOT_WIDTH,
      height: SLIPBOT_HEIGHT * SLIPBOT_COUNT
    }
  },
  west: {
    width: SLIPBOT_HEIGHT,
    height: SLIPBOT_WIDTH,
    exitVector: { x: -1, y: 0 },
    exitSteps: SLIPBOT_HEIGHT,
    botOffset(index) {
      return { x: index * SLIPBOT_HEIGHT, y: 0 };
    },
    trailerSize: {
      width: SLIPBOT_HEIGHT * SLIPBOT_COUNT,
      height: SLIPBOT_WIDTH
    }
  }
};

function normalizeOrientation(orientation) {
  if (!orientation) return "north";
  return ORIENTATION_SEQUENCE.includes(orientation) ? orientation : "north";
}

function rotateOrientation(current) {
  const index = ORIENTATION_SEQUENCE.indexOf(normalizeOrientation(current));
  const nextIndex = (index + 1) % ORIENTATION_SEQUENCE.length;
  return ORIENTATION_SEQUENCE[nextIndex];
}

function headingFromOrientation(orientation) {
  const key = normalizeOrientation(orientation);
  switch (key) {
    case "east":
      return 0;
    case "south":
      return 90;
    case "west":
      return 180;
    case "north":
    default:
      return 270;
  }
}

function normalizeAngle(angle) {
  const value = Number.isFinite(angle) ? angle : 0;
  return ((value % 360) + 360) % 360;
}

function orientationFromAngle(angle) {
  const normalized = normalizeAngle(angle);
  if (normalized >= 315 || normalized < 45) return "east";
  if (normalized >= 45 && normalized < 135) return "south";
  if (normalized >= 135 && normalized < 225) return "west";
  return "north";
}

function shortestAngleDelta(from, to) {
  const start = normalizeAngle(from);
  const end = normalizeAngle(to);
  let delta = end - start;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function interpolateAngles(from, to, t) {
  const delta = shortestAngleDelta(from, to);
  return normalizeAngle(from + delta * Math.min(Math.max(t, 0), 1));
}

function getOrientationDimensions(orientation) {
  const key = normalizeOrientation(orientation);
  const config = ORIENTATION_CONFIG[key];
  return { width: config.width, height: config.height };
}

function describeOrientation(orientation) {
  const key = normalizeOrientation(orientation);
  const label = key === "north" ? "north" : "east";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getTrailerDimensions(orientation) {
  const key = normalizeOrientation(orientation);
  const config = ORIENTATION_CONFIG[key];
  return { ...config.trailerSize };
}

function getOrientationExitConfig(orientation) {
  const key = normalizeOrientation(orientation);
  const config = ORIENTATION_CONFIG[key];
  return { vector: { ...config.exitVector }, steps: config.exitSteps };
}

const DEFAULT_ALLOWED_AREA = {
  x: 1,
  y: 1,
  width: GRID_WIDTH - 2,
  height: GRID_HEIGHT - 2
};
const TRAILER_CLEARANCE = 1;
const TRAILER_DEFAULT_X = 4;
const TRAILER_DEFAULT_Y = GRID_HEIGHT - SLIPBOT_HEIGHT * SLIPBOT_COUNT - 4;

const DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 }
];

function pointKey(x, y) {
  return `${x},${y}`;
}

function forEachFootprintCell(x, y, width, height, callback) {
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < height; dy += 1) {
      callback(x + dx, y + dy);
    }
  }
}

function collectFootprintKeys(x, y, orientation) {
  const keys = [];
  const { width, height } = getOrientationDimensions(orientation);
  forEachFootprintCell(x, y, width, height, (fx, fy) => {
    keys.push(pointKey(fx, fy));
  });
  return keys;
}

function areaContainsFootprint(area, x, y, orientation) {
  if (!area) return false;
  const { width, height } = getOrientationDimensions(orientation);
  const withinX = x >= area.x && x + width <= area.x + area.width;
  const withinY = y >= area.y && y + height <= area.y + area.height;
  return withinX && withinY;
}

function footprintWithinGrid(x, y, orientation) {
  const { width, height } = getOrientationDimensions(orientation);
  return x >= 0 && y >= 0 && x + width <= GRID_WIDTH && y + height <= GRID_HEIGHT;
}

function isFootprintFree(x, y, orientation, area, blockedSet) {
  if (!footprintWithinGrid(x, y, orientation)) return false;
  if (!areaContainsFootprint(area, x, y, orientation)) return false;
  const { width, height } = getOrientationDimensions(orientation);
  let free = true;
  forEachFootprintCell(x, y, width, height, (cx, cy) => {
    if (!free) return;
    if (blockedSet.has(pointKey(cx, cy))) {
      free = false;
    }
  });
  return free;
}

function reconstructPath(cameFrom, currentKey, nodeLookup) {
  const path = [];
  let key = currentKey;
  while (key) {
    const node = nodeLookup.get(key);
    if (!node) break;
    path.push(node);
    key = cameFrom.get(key) ?? null;
  }
  return path.reverse();
}

function orientationKey(node) {
  return `${node.x},${node.y},${normalizeOrientation(node.orientation)}`;
}

function heuristicState(a, b) {
  const aDims = getOrientationDimensions(a.orientation);
  const bDims = getOrientationDimensions(b.orientation);
  const ax = a.x + aDims.width / 2;
  const ay = a.y + aDims.height / 2;
  const bx = b.x + bDims.width / 2;
  const by = b.y + bDims.height / 2;
  const distance = Math.abs(ax - bx) + Math.abs(ay - by);
  return a.orientation === b.orientation ? distance : distance + 1;
}

function planAStarWithRotations(start, goal, area, blockedSet) {
  if (!start || !goal) return null;

  const normalizedStart = {
    x: start.x,
    y: start.y,
    orientation: normalizeOrientation(start.orientation)
  };
  const normalizedGoal = {
    x: goal.x,
    y: goal.y,
    orientation: normalizeOrientation(goal.orientation)
  };

  if (!isFootprintFree(normalizedGoal.x, normalizedGoal.y, normalizedGoal.orientation, area, blockedSet)) {
    return null;
  }
  if (!isFootprintFree(normalizedStart.x, normalizedStart.y, normalizedStart.orientation, area, blockedSet)) {
    return null;
  }

  const startKey = orientationKey(normalizedStart);
  const goalKey = orientationKey(normalizedGoal);

  const openMap = new Map([[startKey, normalizedStart]]);
  const cameFrom = new Map();
  const nodeLookup = new Map([[startKey, normalizedStart]]);
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, heuristicState(normalizedStart, normalizedGoal)]]);
  const closedSet = new Set();

  const maxIterations = GRID_WIDTH * GRID_HEIGHT * ORIENTATION_SEQUENCE.length * 10;
  let iterations = 0;

  while (openMap.size > 0 && iterations < maxIterations) {
    iterations += 1;
    let currentKey = null;
    let currentNode = null;
    let bestScore = Infinity;

    for (const [key, node] of openMap.entries()) {
      const score = fScore.get(key) ?? Infinity;
      if (score < bestScore) {
        bestScore = score;
        currentKey = key;
        currentNode = node;
      }
    }

    if (!currentNode || currentKey === null) {
      break;
    }

    if (currentKey === goalKey) {
      return reconstructPath(cameFrom, currentKey, nodeLookup);
    }

    openMap.delete(currentKey);
    closedSet.add(currentKey);

    const currentG = gScore.get(currentKey) ?? Infinity;

    const moveNeighbors = DIRECTIONS.map(({ dx, dy }) => ({
      x: currentNode.x + dx,
      y: currentNode.y + dy,
      orientation: currentNode.orientation
    }));

    const rotationNeighbor = (() => {
      const rotated = rotateOrientation(currentNode.orientation);
      if (rotated === currentNode.orientation) return null;
      return { x: currentNode.x, y: currentNode.y, orientation: rotated };
    })();

    const neighbors = [...moveNeighbors];
    if (rotationNeighbor) {
      neighbors.push(rotationNeighbor);
    }

    for (const neighbor of neighbors) {
      const neighborKey = orientationKey(neighbor);
      if (closedSet.has(neighborKey)) continue;

      if (!footprintWithinGrid(neighbor.x, neighbor.y, neighbor.orientation)) continue;
      if (!isFootprintFree(neighbor.x, neighbor.y, neighbor.orientation, area, blockedSet)) continue;

      const tentativeG = currentG + 1;
      const neighborG = gScore.get(neighborKey);

      if (neighborG === undefined || tentativeG < neighborG) {
        cameFrom.set(neighborKey, currentKey);
        nodeLookup.set(neighborKey, neighbor);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + heuristicState(neighbor, normalizedGoal));
        openMap.set(neighborKey, neighbor);
      }
    }
  }

  return null;
}

const DEFAULT_TRAILER_ORIGIN = { x: TRAILER_DEFAULT_X, y: TRAILER_DEFAULT_Y };

function createInitialSlipbots(origin = DEFAULT_TRAILER_ORIGIN, orientation = "north") {
  const key = normalizeOrientation(orientation);
  const config = ORIENTATION_CONFIG[key];
  return [
    {
      id: "slipbot-1",
      name: "SlipBot A",
      color: "#38bdf8",
      position: {
        x: origin.x + config.botOffset(0).x,
        y: origin.y + config.botOffset(0).y
      },
      orientation: key,
      heading: headingFromOrientation(key),
      status: "waiting"
    },
    {
      id: "slipbot-2",
      name: "SlipBot B",
      color: "#22c55e",
      position: {
        x: origin.x + config.botOffset(1).x,
        y: origin.y + config.botOffset(1).y
      },
      orientation: key,
      heading: headingFromOrientation(key),
      status: "waiting"
    },
    {
      id: "slipbot-3",
      name: "SlipBot C",
      color: "#f97316",
      position: {
        x: origin.x + config.botOffset(2).x,
        y: origin.y + config.botOffset(2).y
      },
      orientation: key,
      heading: headingFromOrientation(key),
      status: "waiting"
    }
  ];
}

function SimulatorV2() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const areaAnchorRef = useRef(null);

  const [allowedArea, setAllowedArea] = useState(DEFAULT_ALLOWED_AREA);
  const [isDefiningArea, setIsDefiningArea] = useState(false);
  const [draftArea, setDraftArea] = useState(null);
  const [obstacleKeys, setObstacleKeys] = useState([]);
  const [obstacleSlipbots, setObstacleSlipbots] = useState([]);
  const [parkingAssignments, setParkingAssignments] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [trailerOrientation, setTrailerOrientation] = useState("north");
  const [obstacleSlipbotOrientation, setObstacleSlipbotOrientation] = useState("north");
  const [slipbots, setSlipbots] = useState(() => createInitialSlipbots(DEFAULT_TRAILER_ORIGIN, "north"));
  const [trailerOrigin, setTrailerOrigin] = useState(DEFAULT_TRAILER_ORIGIN);
  const [trailerPreview, setTrailerPreview] = useState(null);
  const [obstacleSlipbotPreview, setObstacleSlipbotPreview] = useState(null);
  const [status, setStatus] = useState(
    "Define the workspace, position the trailer, right-click to place obstacles, then choose three parking locations."
  );
  const [currentPath, setCurrentPath] = useState([]);
  const [sequenceState, setSequenceState] = useState({ running: false, activeBotId: null, queueIndex: -1 });
  const [isPlacingTrailer, setIsPlacingTrailer] = useState(false);
  const [isAddingObstacleSlipbot, setIsAddingObstacleSlipbot] = useState(false);

  const obstacleSet = useMemo(() => new Set(obstacleKeys), [obstacleKeys]);
  const obstacleSlipbotSet = useMemo(() => {
    const set = new Set();
    obstacleSlipbots.forEach(item => {
      const dims = getOrientationDimensions(item.orientation);
      forEachFootprintCell(item.position.x, item.position.y, dims.width, dims.height, (fx, fy) => {
        set.add(pointKey(fx, fy));
      });
    });
    return set;
  }, [obstacleSlipbots]);
  const isSequenceActive = sequenceState.running;

  const slipbotsRef = useRef(slipbots);
  const allowedAreaRef = useRef(allowedArea);
  const obstacleSetRef = useRef(obstacleSet);
  const obstacleSlipbotSetRef = useRef(obstacleSlipbotSet);
  const parkingAssignmentsRef = useRef(parkingAssignments);
  const slotInteractionRef = useRef(null);

  useEffect(() => {
    slipbotsRef.current = slipbots;
  }, [slipbots]);

  useEffect(() => {
    allowedAreaRef.current = allowedArea;
  }, [allowedArea]);

  useEffect(() => {
    obstacleSetRef.current = obstacleSet;
  }, [obstacleSet]);

  useEffect(() => {
    obstacleSlipbotSetRef.current = obstacleSlipbotSet;
  }, [obstacleSlipbotSet]);

  useEffect(() => {
    parkingAssignmentsRef.current = parkingAssignments;
  }, [parkingAssignments]);

  const canvasWidth = useMemo(() => GRID_WIDTH * CELL_SIZE, []);
  const canvasHeight = useMemo(() => GRID_HEIGHT * CELL_SIZE, []);

  const clearAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAnimation();
    };
  }, [clearAnimation]);

  const computeWorkspaceFromCell = useCallback(cell => {
    if (!cell || !areaAnchorRef.current) return null;
    const anchor = areaAnchorRef.current;
    const minX = Math.min(anchor.x, cell.x);
    const minY = Math.min(anchor.y, cell.y);
    const maxX = Math.max(anchor.x, cell.x);
    const maxY = Math.max(anchor.y, cell.y);
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }, []);

  const getCellFromEvent = useCallback(event => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX ?? 0;
    const clientY = event.clientY ?? 0;
    const x = Math.floor((clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((clientY - rect.top) / CELL_SIZE);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return null;
    return { x, y };
  }, []);

  const getPointFromEvent = useCallback(event => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX ?? 0;
    const clientY = event.clientY ?? 0;
    const x = (clientX - rect.left) / CELL_SIZE;
    const y = (clientY - rect.top) / CELL_SIZE;
    return { x, y };
  }, []);

  const clampTopLeft = useCallback(
    (cell, orientation) => {
      if (!cell) return null;
      const area = draftArea ?? allowedArea;
      if (!area) return null;
      const dims = getOrientationDimensions(orientation);
      const maxX = area.x + area.width - dims.width;
      const maxY = area.y + area.height - dims.height;
      const clampedX = Math.max(area.x, Math.min(cell.x, maxX));
      const clampedY = Math.max(area.y, Math.min(cell.y, maxY));
      return { x: clampedX, y: clampedY };
    },
    [allowedArea, draftArea]
  );

  const clampTrailerOrigin = useCallback((cell, orientation) => {
    if (!cell) return null;
    const dims = getTrailerDimensions(orientation);
    const maxX = GRID_WIDTH - dims.width - TRAILER_CLEARANCE;
    const maxY = GRID_HEIGHT - dims.height - TRAILER_CLEARANCE;
    const clampedX = Math.max(TRAILER_CLEARANCE, Math.min(cell.x, maxX));
    const clampedY = Math.max(TRAILER_CLEARANCE, Math.min(cell.y, maxY));
    return { x: clampedX, y: clampedY };
  }, []);

  const clampObstacleSlipbot = useCallback(
    (cell, orientation) => {
      if (!cell) return null;
      const area = draftArea ?? allowedArea;
      if (!area) return null;
      const dims = getOrientationDimensions(orientation);
      const maxX = area.x + area.width - dims.width;
      const maxY = area.y + area.height - dims.height;
      const clampedX = Math.max(area.x, Math.min(cell.x, maxX));
      const clampedY = Math.max(area.y, Math.min(cell.y, maxY));
      return { x: clampedX, y: clampedY };
    },
    [allowedArea, draftArea]
  );

  const findParkingSlotAtCell = useCallback(cell => {
    if (!cell) return null;
    const assignments = parkingAssignmentsRef.current;
    if (!assignments) return null;
    for (const assignment of assignments) {
      const dims = getOrientationDimensions(assignment.orientation);
      const withinX = cell.x >= assignment.position.x && cell.x < assignment.position.x + dims.width;
      const withinY = cell.y >= assignment.position.y && cell.y < assignment.position.y + dims.height;
      if (withinX && withinY) {
        return assignment;
      }
    }
    return null;
  }, []);

  const handlePointerDown = useCallback(
    event => {
      if (isSequenceActive) return;
      if (event.button !== 0) return;
      const cell = getCellFromEvent(event);
      if (!cell) return;

      if (isPlacingTrailer) {
        const origin = clampTrailerOrigin(cell, trailerOrientation);
        if (!origin || !allowedArea) return;
        const staged = createInitialSlipbots(origin, trailerOrientation);
        const insideWorkspace = staged.every(bot =>
          areaContainsFootprint(allowedArea, bot.position.x, bot.position.y, bot.orientation)
        );
        if (!insideWorkspace) {
          setStatus("Trailer must be positioned within the workspace bounds.");
          return;
        }
        const trailerFootprints = staged.flatMap(bot =>
          collectFootprintKeys(bot.position.x, bot.position.y, bot.orientation)
        );
        const overlapsObstacles = trailerFootprints.some(
          key => obstacleSet.has(key) || obstacleSlipbotSet.has(key)
        );
        if (overlapsObstacles) {
          setStatus("Trailer placement overlaps an existing obstacle. Choose a clear spot.");
          return;
        }
        const parkingFootprints = parkingAssignments.flatMap(assignment =>
          collectFootprintKeys(assignment.position.x, assignment.position.y, assignment.orientation)
        );
        const parkingFootprintSet = new Set(parkingFootprints);
        const overlapsParking = trailerFootprints.some(key => parkingFootprintSet.has(key));
        if (overlapsParking) {
          setStatus("Trailer cannot overlap a planned parking slot.");
          return;
        }
        setTrailerOrigin(origin);
        setSlipbots(staged);
        slipbotsRef.current = staged;
        setTrailerPreview(null);
        setIsPlacingTrailer(false);
        setStatus(
          `Trailer positioned at (${origin.x}, ${origin.y}) facing ${describeOrientation(
            trailerOrientation
          )}. SlipBots staged nose to tail.`
        );
        return;
      }

      if (isAddingObstacleSlipbot) {
        if (!allowedArea) return;
        const origin = clampObstacleSlipbot(cell, obstacleSlipbotOrientation);
        if (!origin) return;
        if (!areaContainsFootprint(allowedArea, origin.x, origin.y, obstacleSlipbotOrientation)) {
          setStatus("Obstacle SlipBots must be inside the workspace.");
          return;
        }
        const candidateKeys = collectFootprintKeys(origin.x, origin.y, obstacleSlipbotOrientation);
        const slipbotKeys = new Set();
        slipbotsRef.current.forEach(bot => {
          collectFootprintKeys(bot.position.x, bot.position.y, bot.orientation).forEach(key =>
            slipbotKeys.add(key)
          );
        });
        const parkingKeys = new Set();
        parkingAssignments.forEach(assignment => {
          collectFootprintKeys(assignment.position.x, assignment.position.y, assignment.orientation).forEach(key =>
            parkingKeys.add(key)
          );
        });
        const overlaps = candidateKeys.some(key => {
          if (obstacleSet.has(key)) return true;
          if (obstacleSlipbotSet.has(key)) return true;
          return slipbotKeys.has(key);
        });
        if (overlaps) {
          setStatus("Placement overlaps another SlipBot or obstacle. Choose a clear space.");
          return;
        }
        const overlapsParking = candidateKeys.some(key => parkingKeys.has(key));
        if (overlapsParking) {
          setStatus("SlipBot obstacle cannot overlap a parking slot.");
          return;
        }
        setObstacleSlipbots(prev => [
          ...prev,
          {
            id: `obstacle-slipbot-${Date.now()}`,
            position: origin,
            orientation: obstacleSlipbotOrientation
          }
        ]);
        setObstacleSlipbotPreview(null);
        setStatus(
          `Obstacle SlipBot added at (${origin.x}, ${origin.y}) facing ${describeOrientation(obstacleSlipbotOrientation)}.`
        );
        return;
      }

      if (isDefiningArea) {
        areaAnchorRef.current = cell;
        setDraftArea({ x: cell.x, y: cell.y, width: 1, height: 1 });
        setStatus("Drag to size the allowable workspace.");
        return;
      }

      const existingSlot = findParkingSlotAtCell(cell);
      if (existingSlot) {
        setSelectedSlotId(existingSlot.id);
        const dims = getOrientationDimensions(existingSlot.orientation);
        const pointerPoint = getPointFromEvent(event);
        const center = {
          x: existingSlot.position.x + dims.width / 2,
          y: existingSlot.position.y + dims.height / 2
        };
        const centerOffset = pointerPoint
          ? { x: pointerPoint.x - center.x, y: pointerPoint.y - center.y }
          : { x: 0, y: 0 };
        slotInteractionRef.current = {
          type: "slot",
          slotId: existingSlot.id,
          centerOffset,
          lastAngle: existingSlot.rotation ?? headingFromOrientation(existingSlot.orientation)
        };
        setStatus(
          `Adjusting parking slot ${existingSlot.id.replace("slot-", "")} – drag to reposition or sweep the cursor to rotate.`
        );
        return;
      }

      if (parkingAssignments.length >= 3) {
        setStatus("Parking slots already defined. Select one to adjust or clear them to choose new targets.");
        return;
      }

      if (!allowedArea) return;
      const insideX = cell.x >= allowedArea.x && cell.x < allowedArea.x + allowedArea.width;
      const insideY = cell.y >= allowedArea.y && cell.y < allowedArea.y + allowedArea.height;
      if (!insideX || !insideY) {
        setStatus("Parking targets must be inside the workspace.");
        return;
      }

      const baseOrientation = normalizeOrientation(trailerOrientation);
      const targetTopLeft = clampTopLeft(cell, baseOrientation);
      if (!targetTopLeft) return;
      if (!areaContainsFootprint(allowedArea, targetTopLeft.x, targetTopLeft.y, baseOrientation)) {
        setStatus("Parking targets must be fully inside the workspace.");
        return;
      }

      const candidateKeys = collectFootprintKeys(targetTopLeft.x, targetTopLeft.y, baseOrientation);
      const candidateKeySet = new Set(candidateKeys);
      const slipbotKeys = new Set();
      slipbotsRef.current.forEach(bot => {
        collectFootprintKeys(bot.position.x, bot.position.y, bot.orientation).forEach(key => slipbotKeys.add(key));
      });
      const overlappingObstacle = candidateKeys.some(key => {
        if (obstacleSet.has(key)) return true;
        if (obstacleSlipbotSet.has(key)) return true;
        return slipbotKeys.has(key);
      });
      if (overlappingObstacle) {
        setStatus("Parking slot overlaps an obstacle. Choose a clear space.");
        return;
      }

      const overlappingExisting = parkingAssignments.some(assignment => {
        const existingKeys = collectFootprintKeys(
          assignment.position.x,
          assignment.position.y,
          assignment.orientation
        );
        return existingKeys.some(key => candidateKeySet.has(key));
      });

      if (overlappingExisting) {
        setStatus("Parking slots cannot overlap.");
        return;
      }

      const slotId = `slot-${parkingAssignments.length + 1}`;
      const rotation = headingFromOrientation(baseOrientation);
      const newSlot = {
        id: slotId,
        position: targetTopLeft,
        orientation: baseOrientation,
        rotation
      };
      setParkingAssignments(prev => [...prev, newSlot]);
      setSelectedSlotId(slotId);
      const dims = getOrientationDimensions(baseOrientation);
      const pointerPoint = getPointFromEvent(event);
      const center = {
        x: targetTopLeft.x + dims.width / 2,
        y: targetTopLeft.y + dims.height / 2
      };
      const centerOffset = pointerPoint
        ? { x: pointerPoint.x - center.x, y: pointerPoint.y - center.y }
        : { x: 0, y: 0 };
      slotInteractionRef.current = {
        type: "slot",
        slotId,
        centerOffset,
        lastAngle: rotation
      };
      setStatus(
        `Parking slot ${parkingAssignments.length + 1} positioned at (${targetTopLeft.x}, ${targetTopLeft.y}). Drag to fine-tune.`
      );
    },
    [
      allowedArea,
      clampTopLeft,
      getCellFromEvent,
      isDefiningArea,
      isSequenceActive,
      allowedArea,
      clampObstacleSlipbot,
      clampTrailerOrigin,
      getCellFromEvent,
      isAddingObstacleSlipbot,
      isDefiningArea,
      isPlacingTrailer,
      isSequenceActive,
      obstacleSet,
      obstacleSlipbotSet,
      parkingAssignments
    ]
  );

  const handlePointerMove = useCallback(
    event => {
      const cell = getCellFromEvent(event);
      const interaction = slotInteractionRef.current;
      if (interaction && interaction.type === "slot") {
        const pointerPoint = getPointFromEvent(event);
        if (!pointerPoint) return;
        const slot = parkingAssignmentsRef.current.find(item => item.id === interaction.slotId);
        if (!slot) return;
        const centerCandidate = {
          x: pointerPoint.x - interaction.centerOffset.x,
          y: pointerPoint.y - interaction.centerOffset.y
        };
        const hasVector =
          Math.abs(pointerPoint.x - centerCandidate.x) > 0.01 || Math.abs(pointerPoint.y - centerCandidate.y) > 0.01;
        const angle = hasVector
          ? (Math.atan2(pointerPoint.y - centerCandidate.y, pointerPoint.x - centerCandidate.x) * 180) / Math.PI
          : interaction.lastAngle;
        const rotation = normalizeAngle(angle);
        const orientation = orientationFromAngle(rotation);
        const dims = getOrientationDimensions(orientation);
        const candidateTopLeft = {
          x: Math.round(centerCandidate.x - dims.width / 2),
          y: Math.round(centerCandidate.y - dims.height / 2)
        };
        const clamped = clampTopLeft(candidateTopLeft, orientation);
        const candidateKeys = collectFootprintKeys(clamped.x, clamped.y, orientation);
        const overlapsObstacle = candidateKeys.some(
          key => obstacleSet.has(key) || obstacleSlipbotSet.has(key)
        );
        if (overlapsObstacle) return;
        const candidateKeySet = new Set(candidateKeys);
        const overlapsSlot = parkingAssignmentsRef.current.some(other => {
          if (other.id === interaction.slotId) return false;
          const otherKeys = collectFootprintKeys(other.position.x, other.position.y, other.orientation);
          return otherKeys.some(key => candidateKeySet.has(key));
        });
        if (overlapsSlot) return;
        setParkingAssignments(prev =>
          prev.map(item =>
            item.id === interaction.slotId
              ? {
                  ...item,
                  position: clamped,
                  orientation,
                  rotation
                }
              : item
          )
        );
        const center = {
          x: clamped.x + dims.width / 2,
          y: clamped.y + dims.height / 2
        };
        slotInteractionRef.current = {
          ...interaction,
          centerOffset: { x: pointerPoint.x - center.x, y: pointerPoint.y - center.y },
          lastAngle: rotation
        };
        return;
      }

      if (isDefiningArea) {
        if (!cell || !areaAnchorRef.current) return;
        const workspace = computeWorkspaceFromCell(cell);
        if (workspace) {
          setDraftArea(workspace);
        }
        return;
      }

      if (isPlacingTrailer) {
        setTrailerPreview(cell ? clampTrailerOrigin(cell, trailerOrientation) : null);
        return;
      }

      if (isAddingObstacleSlipbot) {
        setObstacleSlipbotPreview(
          cell ? clampObstacleSlipbot(cell, obstacleSlipbotOrientation) : null
        );
        return;
      }

    },
    [
      clampObstacleSlipbot,
      clampTopLeft,
      clampTrailerOrigin,
      computeWorkspaceFromCell,
      getCellFromEvent,
      getPointFromEvent,
      isAddingObstacleSlipbot,
      isDefiningArea,
      isPlacingTrailer,
      obstacleSet,
      obstacleSlipbotOrientation,
      obstacleSlipbotSet,
      setParkingAssignments,
      slotInteractionRef,
      trailerOrientation
    ]
  );

  const finalizeWorkspace = useCallback(
    workspace => {
      if (!workspace) return;
      if (workspace.width < SLIPBOT_WIDTH || workspace.height < SLIPBOT_HEIGHT) {
        setStatus("Workspace must be at least 8ft wide and 17ft tall.");
        return;
      }

      const allInside = slipbotsRef.current.every(bot =>
        areaContainsFootprint(workspace, bot.position.x, bot.position.y, bot.orientation)
      );
      if (!allInside) {
        setStatus("Workspace must include the trailer and all SlipBots.");
        return;
      }

      setAllowedArea(workspace);
      setStatus("Workspace updated. Right-click to add obstacles or choose parking slots.");
      setObstacleKeys(prev =>
        prev.filter(key => {
          const [sx, sy] = key.split(",").map(Number);
          return (
            sx >= workspace.x &&
            sx < workspace.x + workspace.width &&
            sy >= workspace.y &&
            sy < workspace.y + workspace.height
          );
        })
      );
      setObstacleSlipbots(prev =>
        prev.filter(item =>
          areaContainsFootprint(workspace, item.position.x, item.position.y, item.orientation)
        )
      );
      setParkingAssignments(prev =>
        prev.filter(assignment =>
          areaContainsFootprint(
            workspace,
            assignment.position.x,
            assignment.position.y,
            assignment.orientation
          )
        )
      );
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    if (isDefiningArea && draftArea) {
      finalizeWorkspace(draftArea);
    }
    areaAnchorRef.current = null;
    setDraftArea(null);
    slotInteractionRef.current = null;
  }, [draftArea, finalizeWorkspace, isDefiningArea]);

  const handlePointerLeave = useCallback(() => {
    setTrailerPreview(null);
    setObstacleSlipbotPreview(null);
    slotInteractionRef.current = null;
  }, []);

  const handleContextMenu = useCallback(
    event => {
      event.preventDefault();
      if (isSequenceActive) return;
      if (isPlacingTrailer || isAddingObstacleSlipbot) return;
      const cell = getCellFromEvent(event);
      if (!cell || !allowedArea) return;
      const { x, y } = cell;
      if (x < allowedArea.x || x >= allowedArea.x + allowedArea.width) {
        setStatus("Obstacles must be inside the workspace.");
        return;
      }
      if (y < allowedArea.y || y >= allowedArea.y + allowedArea.height) {
        setStatus("Obstacles must be inside the workspace.");
        return;
      }

      const conflictsSlipbot = slipbotsRef.current.some(bot => {
        const dims = getOrientationDimensions(bot.orientation);
        return (
          x >= bot.position.x &&
          x < bot.position.x + dims.width &&
          y >= bot.position.y &&
          y < bot.position.y + dims.height
        );
      });
      if (conflictsSlipbot) {
        setStatus("Cannot place an obstacle on top of a SlipBot.");
        return;
      }

      const conflictsSlipbotObstacle = obstacleSlipbots.some(bot => {
        const dims = getOrientationDimensions(bot.orientation);
        return (
          x >= bot.position.x &&
          x < bot.position.x + dims.width &&
          y >= bot.position.y &&
          y < bot.position.y + dims.height
        );
      });
      if (conflictsSlipbotObstacle) {
        setStatus("Cannot place an obstacle on top of a SlipBot obstacle.");
        return;
      }

      const conflictsParking = parkingAssignments.some(assignment => {
        const dims = getOrientationDimensions(assignment.orientation);
        return (
          x >= assignment.position.x &&
          x < assignment.position.x + dims.width &&
          y >= assignment.position.y &&
          y < assignment.position.y + dims.height
        );
      });
      if (conflictsParking) {
        setStatus("Obstacles cannot overlap parking slots.");
        return;
      }

      setObstacleKeys(prev => {
        const key = pointKey(x, y);
        if (prev.includes(key)) {
          return prev.filter(item => item !== key);
        }
        return [...prev, key];
      });
      setStatus("Obstacle map updated.");
    },
    [
      allowedArea,
      getCellFromEvent,
      isAddingObstacleSlipbot,
      isPlacingTrailer,
      isSequenceActive,
      obstacleSlipbots,
      parkingAssignments
    ]
  );

  const toggleWorkspaceMode = useCallback(() => {
    if (isSequenceActive) return;
    setIsDefiningArea(prev => {
      const next = !prev;
      if (next) {
        setIsPlacingTrailer(false);
        setIsAddingObstacleSlipbot(false);
        setTrailerPreview(null);
        setObstacleSlipbotPreview(null);
        setStatus("Click and drag to define the workspace where SlipBots are allowed.");
      } else {
        setStatus("Workspace lock restored. Define parking slots or adjust obstacles.");
        areaAnchorRef.current = null;
        setDraftArea(null);
      }
      return next;
    });
  }, [isSequenceActive]);

  const toggleTrailerPlacement = useCallback(() => {
    if (isSequenceActive) return;
    setIsPlacingTrailer(prev => {
      const next = !prev;
      if (next) {
        setIsDefiningArea(false);
        setIsAddingObstacleSlipbot(false);
        areaAnchorRef.current = null;
        setDraftArea(null);
        setObstacleSlipbotPreview(null);
        setStatus(
          `Click on the canvas to position the trailer. SlipBots will align nose to tail facing ${describeOrientation(
            trailerOrientation
          )}.`
        );
      } else {
        setStatus("Trailer placement mode exited.");
        setTrailerPreview(null);
      }
      return next;
    });
  }, [isSequenceActive, trailerOrientation]);

  const toggleObstacleSlipbotMode = useCallback(() => {
    if (isSequenceActive) return;
    setIsAddingObstacleSlipbot(prev => {
      const next = !prev;
      if (next) {
        setIsDefiningArea(false);
        setIsPlacingTrailer(false);
        areaAnchorRef.current = null;
        setDraftArea(null);
        setTrailerPreview(null);
        setStatus(
          `Click inside the workspace to add a stationary SlipBot obstacle facing ${describeOrientation(
            obstacleSlipbotOrientation
          )}.`
        );
      } else {
        setStatus("SlipBot obstacle placement mode exited.");
        setObstacleSlipbotPreview(null);
      }
      return next;
    });
  }, [isSequenceActive, obstacleSlipbotOrientation]);

  const handleRotateTrailer = useCallback(() => {
    if (isSequenceActive) return;
    if (!allowedArea) {
      setStatus("Define the workspace before rotating the trailer.");
      return;
    }
    const nextOrientation = rotateOrientation(trailerOrientation);
    const origin = clampTrailerOrigin(trailerOrigin, nextOrientation);
    if (!origin) return;

    const staged = createInitialSlipbots(origin, nextOrientation);
    const insideWorkspace = staged.every(bot =>
      areaContainsFootprint(allowedArea, bot.position.x, bot.position.y, bot.orientation)
    );
    if (!insideWorkspace) {
      setStatus("Rotating the trailer would move SlipBots outside the workspace bounds.");
      return;
    }

    const trailerFootprints = staged.flatMap(bot =>
      collectFootprintKeys(bot.position.x, bot.position.y, bot.orientation)
    );
    const overlapsObstacles = trailerFootprints.some(
      key => obstacleSet.has(key) || obstacleSlipbotSet.has(key)
    );
    if (overlapsObstacles) {
      setStatus("Clear nearby obstacles before rotating the trailer into this orientation.");
      return;
    }

    const parkingKeys = new Set(
      parkingAssignments.flatMap(assignment =>
        collectFootprintKeys(assignment.position.x, assignment.position.y, assignment.orientation)
      )
    );
    const overlapsParking = trailerFootprints.some(key => parkingKeys.has(key));
    if (overlapsParking) {
      setStatus("Rotating the trailer now would overlap a parking slot.");
      return;
    }

    setTrailerOrigin(origin);
    setTrailerOrientation(nextOrientation);
    setSlipbots(staged);
    slipbotsRef.current = staged;
    setTrailerPreview(null);
    setStatus(`Trailer rotated to face ${describeOrientation(nextOrientation)}.`);
  }, [
    allowedArea,
    clampTrailerOrigin,
    isSequenceActive,
    obstacleSet,
    obstacleSlipbotSet,
    parkingAssignments,
    trailerOrientation,
    trailerOrigin
  ]);

  const handleRotateObstacleOrientation = useCallback(() => {
    if (isSequenceActive) return;
    const next = rotateOrientation(obstacleSlipbotOrientation);
    setObstacleSlipbotOrientation(next);
    setObstacleSlipbotPreview(null);
    setStatus(`SlipBot obstacle template rotated to ${describeOrientation(next)}.`);
  }, [isSequenceActive, obstacleSlipbotOrientation]);

  const handleClearParking = useCallback(() => {
    if (isSequenceActive) return;
    setParkingAssignments([]);
    setSelectedSlotId(null);
    setStatus("Parking slots cleared. Click inside the workspace to set new targets.");
  }, [isSequenceActive]);

  const handleResetEnvironment = useCallback(() => {
    clearAnimation();
    setAllowedArea(DEFAULT_ALLOWED_AREA);
    setIsDefiningArea(false);
    setDraftArea(null);
    setObstacleKeys([]);
    setObstacleSlipbots([]);
    setParkingAssignments([]);
    setSelectedSlotId(null);
    const resetBots = createInitialSlipbots(DEFAULT_TRAILER_ORIGIN, "north");
    setSlipbots(resetBots);
    slipbotsRef.current = resetBots;
    setTrailerOrigin(DEFAULT_TRAILER_ORIGIN);
    setTrailerOrientation("north");
    setObstacleSlipbotOrientation("north");
    setTrailerPreview(null);
    setObstacleSlipbotPreview(null);
    setIsPlacingTrailer(false);
    setIsAddingObstacleSlipbot(false);
    setSequenceState({ running: false, activeBotId: null, queueIndex: -1 });
    setCurrentPath([]);
    slotInteractionRef.current = null;
    setStatus("Environment reset. Define the workspace, position the trailer, and select three parking slots.");
  }, [clearAnimation]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const area = draftArea ?? allowedArea;
    if (area) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
      ctx.fillRect(area.x * CELL_SIZE, area.y * CELL_SIZE, area.width * CELL_SIZE, area.height * CELL_SIZE);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
      ctx.lineWidth = 3;
      ctx.strokeRect(area.x * CELL_SIZE, area.y * CELL_SIZE, area.width * CELL_SIZE, area.height * CELL_SIZE);

      ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
      ctx.font = "14px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${area.width} ft`,
        area.x * CELL_SIZE + (area.width * CELL_SIZE) / 2,
        area.y * CELL_SIZE - 6
      );
      ctx.save();
      ctx.translate(area.x * CELL_SIZE - 8, area.y * CELL_SIZE + (area.height * CELL_SIZE) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${area.height} ft`, 0, 0);
      ctx.restore();
    }

    const renderTrailerBounds = (origin, orientation, options = {}) => {
      if (!origin) return;
      const padding = options.padding ?? TRAILER_CLEARANCE;
      const alpha = options.alpha ?? 0.12;
      const strokeAlpha = options.strokeAlpha ?? 0.5;
      const trailerDims = getTrailerDimensions(orientation);
      const topLeftX = (origin.x - padding) * CELL_SIZE;
      const topLeftY = (origin.y - padding) * CELL_SIZE;
      const width = (trailerDims.width + padding * 2) * CELL_SIZE;
      const height = (trailerDims.height + padding * 2) * CELL_SIZE;
      ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;
      ctx.fillRect(topLeftX, topLeftY, width, height);
      ctx.strokeStyle = `rgba(226, 232, 240, ${strokeAlpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(topLeftX, topLeftY, width, height);
      if (options.dashed) {
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = `rgba(148, 163, 184, ${strokeAlpha + 0.1})`;
        ctx.strokeRect(
          origin.x * CELL_SIZE,
          origin.y * CELL_SIZE,
          trailerDims.width * CELL_SIZE,
          trailerDims.height * CELL_SIZE
        );
        ctx.restore();
      }
    };

    renderTrailerBounds(trailerOrigin, trailerOrientation, {
      padding: TRAILER_CLEARANCE,
      alpha: 0.08,
      strokeAlpha: 0.38
    });
    if (trailerPreview) {
      renderTrailerBounds(trailerPreview, trailerOrientation, {
        padding: TRAILER_CLEARANCE,
        alpha: 0.18,
        strokeAlpha: 0.6,
        dashed: true
      });
    }

    ctx.fillStyle = "rgba(248, 113, 113, 0.82)";
    obstacleKeys.forEach(key => {
      const [ox, oy] = key.split(",").map(Number);
      ctx.fillRect(ox * CELL_SIZE, oy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = "rgba(248, 113, 113, 0.95)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox * CELL_SIZE, oy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    obstacleSlipbots.forEach(bot => {
      const dims = getOrientationDimensions(bot.orientation);
      ctx.fillStyle = "rgba(148, 163, 184, 0.28)";
      ctx.fillRect(
        bot.position.x * CELL_SIZE,
        bot.position.y * CELL_SIZE,
        dims.width * CELL_SIZE,
        dims.height * CELL_SIZE
      );
      ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        bot.position.x * CELL_SIZE,
        bot.position.y * CELL_SIZE,
        dims.width * CELL_SIZE,
        dims.height * CELL_SIZE
      );
    });

    if (obstacleSlipbotPreview) {
      const dims = getOrientationDimensions(obstacleSlipbotOrientation);
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        obstacleSlipbotPreview.x * CELL_SIZE,
        obstacleSlipbotPreview.y * CELL_SIZE,
        dims.width * CELL_SIZE,
        dims.height * CELL_SIZE
      );
      ctx.restore();
    }

    parkingAssignments.forEach((assignment, index) => {
      const dims = getOrientationDimensions(assignment.orientation);
      const isSelected = assignment.id === selectedSlotId;
      const baseX = assignment.position.x * CELL_SIZE;
      const baseY = assignment.position.y * CELL_SIZE;
      ctx.fillStyle = isSelected ? "rgba(34, 197, 94, 0.32)" : "rgba(34, 197, 94, 0.18)";
      ctx.fillRect(baseX, baseY, dims.width * CELL_SIZE, dims.height * CELL_SIZE);
      ctx.strokeStyle = isSelected ? "rgba(34, 197, 94, 0.9)" : "rgba(34, 197, 94, 0.55)";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(baseX, baseY, dims.width * CELL_SIZE, dims.height * CELL_SIZE);
      ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
      ctx.font = "16px 'Inter', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Slot ${index + 1}`, baseX + 8, baseY + 6);

      const rotation = normalizeAngle(
        assignment.rotation ?? headingFromOrientation(assignment.orientation)
      );
      const centerX = baseX + (dims.width * CELL_SIZE) / 2;
      const centerY = baseY + (dims.height * CELL_SIZE) / 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.strokeStyle = isSelected ? "rgba(226, 232, 240, 0.9)" : "rgba(226, 232, 240, 0.65)";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(-SLIPBOT_HEIGHT * CELL_SIZE * 0.4, 0);
      ctx.lineTo(SLIPBOT_HEIGHT * CELL_SIZE * 0.45, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(SLIPBOT_HEIGHT * CELL_SIZE * 0.45, 0);
      ctx.lineTo(SLIPBOT_HEIGHT * CELL_SIZE * 0.33, -SLIPBOT_WIDTH * CELL_SIZE * 0.25);
      ctx.lineTo(SLIPBOT_HEIGHT * CELL_SIZE * 0.33, SLIPBOT_WIDTH * CELL_SIZE * 0.25);
      ctx.closePath();
      ctx.fillStyle = isSelected ? "rgba(226, 232, 240, 0.95)" : "rgba(226, 232, 240, 0.72)";
      ctx.fill();
      ctx.restore();
    });

    if (currentPath.length > 1) {
      const activeBot = slipbotsRef.current.find(bot => bot.id === sequenceState.activeBotId);
      ctx.strokeStyle = activeBot ? activeBot.color : "#38bdf8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      currentPath.forEach((step, idx) => {
        const orientation = normalizeOrientation(step.orientation ?? activeBot?.orientation ?? "north");
        const dims = getOrientationDimensions(orientation);
        const cx = step.x * CELL_SIZE + (dims.width * CELL_SIZE) / 2;
        const cy = step.y * CELL_SIZE + (dims.height * CELL_SIZE) / 2;
        if (idx === 0) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      });
      ctx.stroke();
    }

    slipbots.forEach(bot => {
      const orientation = normalizeOrientation(bot.orientation);
      const dims = getOrientationDimensions(orientation);
      const centerX = (bot.position.x + dims.width / 2) * CELL_SIZE;
      const centerY = (bot.position.y + dims.height / 2) * CELL_SIZE;
      const heading = normalizeAngle(bot.heading ?? headingFromOrientation(orientation));
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((heading * Math.PI) / 180);
      ctx.fillStyle = `${bot.color}dd`;
      ctx.strokeStyle = bot.color;
      ctx.lineWidth = 3;
      const bodyLength = SLIPBOT_HEIGHT * CELL_SIZE;
      const bodyWidth = SLIPBOT_WIDTH * CELL_SIZE;
      ctx.beginPath();
      ctx.rect(-bodyLength / 2, -bodyWidth / 2, bodyLength, bodyWidth);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = "15px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bot.name.replace("SlipBot ", ""), 0, 0);
      ctx.restore();
    });
  }, [
    allowedArea,
    canvasHeight,
    canvasWidth,
    currentPath,
    draftArea,
    isSequenceActive,
    obstacleKeys,
    obstacleSlipbotOrientation,
    obstacleSlipbotPreview,
    obstacleSlipbots,
    parkingAssignments,
    selectedSlotId,
    sequenceState.activeBotId,
    slipbots,
    trailerOrigin,
    trailerOrientation,
    trailerPreview
  ]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  const computeExitSegment = useCallback(
    bot => {
      const orientation = normalizeOrientation(bot.orientation);
      const trailerKey = normalizeOrientation(trailerOrientation);
      if (orientation !== trailerKey) {
        return null;
      }
      const exitConfig = getOrientationExitConfig(trailerKey);
      const trailerDims = getTrailerDimensions(trailerKey);
      const dims = getOrientationDimensions(orientation);

      let distanceToOpening = 0;
      if (trailerKey === "north") {
        distanceToOpening = bot.position.y - trailerOrigin.y;
      } else if (trailerKey === "south") {
        const trailerBottom = trailerOrigin.y + trailerDims.height;
        distanceToOpening = trailerBottom - (bot.position.y + dims.height);
      } else if (trailerKey === "east") {
        const frontTopLeftX = trailerOrigin.x + trailerDims.width - dims.width;
        distanceToOpening = frontTopLeftX - bot.position.x;
      } else if (trailerKey === "west") {
        distanceToOpening = bot.position.x - trailerOrigin.x;
      }

      const totalSteps = distanceToOpening + exitConfig.steps;
      const segment = [
        { x: bot.position.x, y: bot.position.y, orientation },
      ];
      let current = { x: bot.position.x, y: bot.position.y, orientation };
      for (let i = 0; i < totalSteps; i += 1) {
        current = {
          x: current.x + exitConfig.vector.x,
          y: current.y + exitConfig.vector.y,
          orientation
        };
        segment.push(current);
      }
      return segment;
    },
    [trailerOrigin, trailerOrientation]
  );

  const buildBlockedSetForBot = useCallback(botId => {
    const blocked = new Set(obstacleSetRef.current);
    obstacleSlipbotSetRef.current.forEach(key => blocked.add(key));
    slipbotsRef.current.forEach(bot => {
      if (bot.id === botId) return;
      const dims = getOrientationDimensions(bot.orientation);
      forEachFootprintCell(bot.position.x, bot.position.y, dims.width, dims.height, (bx, by) => {
        blocked.add(pointKey(bx, by));
      });
    });
    return blocked;
  }, []);

  const animateSlipbot = useCallback(
    (botId, path, onComplete) => {
      clearAnimation();
      if (!path || path.length <= 1) {
        onComplete();
        return;
      }

      const bot = slipbotsRef.current.find(item => item.id === botId);
      const startingOrientation = normalizeOrientation(
        path[0]?.orientation ?? bot?.orientation ?? "north"
      );
      let lastHeading = bot?.heading ?? headingFromOrientation(startingOrientation);
      let lastPoint = { x: path[0].x, y: path[0].y };
      let lastOrientation = startingOrientation;

      const segments = [];
      for (let i = 1; i < path.length; i += 1) {
        const node = path[i];
        const nextOrientation = normalizeOrientation(node.orientation ?? lastOrientation);
        const nextHeading = headingFromOrientation(nextOrientation);
        const dx = node.x - lastPoint.x;
        const dy = node.y - lastPoint.y;
        const distance = Math.hypot(dx, dy);
        const moveDuration = distance / SLIPBOT_SPEED_FTPS;
        const rotationDelta = Math.abs(shortestAngleDelta(lastHeading, nextHeading));
        const rotationDuration = rotationDelta / SLIPBOT_ROTATION_SPEED_DEG;
        const duration = Math.max(moveDuration, rotationDuration, rotationDelta > 0 ? 0.18 : 0.1);
        segments.push({
          start: { x: lastPoint.x, y: lastPoint.y },
          end: { x: node.x, y: node.y },
          startHeading: lastHeading,
          endHeading: nextHeading,
          startOrientation: lastOrientation,
          endOrientation: nextOrientation,
          duration,
          move: distance > 0.001
        });
        lastPoint = { x: node.x, y: node.y };
        lastHeading = nextHeading;
        lastOrientation = nextOrientation;
      }

      if (segments.length === 0) {
        onComplete();
        return;
      }

      let segmentIndex = 0;
      let segmentStart = performance.now();
      let currentPosition = { x: path[0].x, y: path[0].y };
      let currentHeading =
        slipbotsRef.current.find(item => item.id === botId)?.heading ?? headingFromOrientation(startingOrientation);
      let currentOrientation = startingOrientation;

      const updateBotState = (position, heading, orientation) => {
        setSlipbots(prev =>
          prev.map(item =>
            item.id === botId
              ? {
                  ...item,
                  position,
                  heading,
                  orientation
                }
              : item
          )
        );
      };

      updateBotState(currentPosition, currentHeading, currentOrientation);

      const tick = now => {
        const segment = segments[segmentIndex];
        if (!segment) {
          animationRef.current = null;
          updateBotState(currentPosition, currentHeading);
          onComplete();
          return;
        }

        const elapsed = (now - segmentStart) / 1000;
        const duration = Math.max(segment.duration, 0.001);
        const t = Math.min(elapsed / duration, 1);
        const position = segment.move
          ? {
              x: segment.start.x + (segment.end.x - segment.start.x) * t,
              y: segment.start.y + (segment.end.y - segment.start.y) * t
            }
          : { x: segment.start.x, y: segment.start.y };
        const heading = interpolateAngles(segment.startHeading, segment.endHeading, t);
        const orientation =
          segment.startOrientation === segment.endOrientation
            ? segment.startOrientation
            : t < 0.5
            ? segment.startOrientation
            : segment.endOrientation;

        updateBotState(position, heading, orientation);
        currentPosition = position;
        currentHeading = heading;
        currentOrientation = orientation;

        if (t >= 1) {
          segmentIndex += 1;
          segmentStart = now;
          if (segmentIndex >= segments.length) {
            updateBotState(
              { x: segment.end.x, y: segment.end.y },
              segment.endHeading,
              segment.endOrientation
            );
            animationRef.current = null;
            onComplete();
            return;
          }
        }

        animationRef.current = requestAnimationFrame(tick);
      };

      animationRef.current = requestAnimationFrame(tick);
    },
    [clearAnimation]
  );

  const runQueue = useCallback(
    (queue, index) => {
      if (index >= queue.length) {
        setSequenceState({ running: false, activeBotId: null, queueIndex: -1 });
        setCurrentPath([]);
        setStatus("All SlipBots are parked. Great work!");
        return;
      }

      const entry = queue[index];
      const bot = slipbotsRef.current.find(item => item.id === entry.botId);
      if (!bot) {
        setSequenceState({ running: false, activeBotId: null, queueIndex: -1 });
        setStatus("Unexpected error locating SlipBot.");
        return;
      }

      const area = allowedAreaRef.current;
      const blocked = buildBlockedSetForBot(bot.id);
      const exitSegment = computeExitSegment(bot);
      if (!exitSegment || exitSegment.length < 2) {
        setSequenceState({ running: false, activeBotId: null, queueIndex: -1 });
        setStatus("Unable to compute a straight-line exit for the active SlipBot.");
        return;
      }

      const corridorClear = exitSegment.every((step, idx) => {
        if (idx === 0) return true;
        const stepOrientation = normalizeOrientation(step.orientation ?? bot.orientation);
        return isFootprintFree(step.x, step.y, stepOrientation, area, blocked);
      });
      if (!corridorClear) {
        setSequenceState({ running: false, activeBotId: null, queueIndex: -1 });
        setCurrentPath([]);
        setStatus(
          `${bot.name} cannot leave the trailer without crossing an obstacle. Clear the exit lane and try again.`
        );
        return;
      }

      const exitComplete = exitSegment[exitSegment.length - 1];
      const navigationPath = planAStarWithRotations(
        { ...exitComplete, orientation: bot.orientation },
        {
          x: entry.target.position.x,
          y: entry.target.position.y,
          orientation: entry.target.orientation
        },
        area,
        blocked
      );

      if (!navigationPath) {
        setSequenceState({ running: false, activeBotId: null, queueIndex: -1 });
        setCurrentPath([]);
        setStatus(
          `${bot.name} could not find a path to its parking slot. Adjust the workspace or obstacles and try again.`
        );
        return;
      }

      const path = navigationPath.length > 0
        ? [...exitSegment, ...navigationPath.slice(1)]
        : exitSegment;

      setSequenceState({ running: true, activeBotId: bot.id, queueIndex: index });
      setCurrentPath(path);
      setSlipbots(prev => prev.map(item => (item.id === bot.id ? { ...item, status: "moving" } : item)));
      setStatus(`${bot.name} is exiting the trailer and navigating to slot ${index + 1}.`);

      animateSlipbot(bot.id, path, () => {
        setSlipbots(prev =>
          prev.map(item =>
            item.id === bot.id
              ? {
                  ...item,
                  position: entry.target.position,
                  orientation: entry.target.orientation,
                  heading: headingFromOrientation(entry.target.orientation),
                  status: "parked"
                }
              : item
          )
        );
        setCurrentPath([]);
        setStatus(`${bot.name} parked successfully.`);
        runQueue(queue, index + 1);
      });
    },
    [animateSlipbot, buildBlockedSetForBot, computeExitSegment]
  );

  const handleExitSlipbots = useCallback(() => {
    if (parkingAssignments.length !== 3) {
      setStatus("Select three parking slots before commanding the exit sequence.");
      return;
    }
    if (isSequenceActive) return;

    const allWaiting = slipbotsRef.current.every(bot => bot.status === "waiting");
    if (!allWaiting) {
      setStatus("Reset the environment to run the exit sequence again.");
      return;
    }

    const waitingBots = slipbotsRef.current.filter(bot => bot.status === "waiting");
    const sortedWaiting = [...waitingBots].sort((a, b) => {
      const orientation = normalizeOrientation(trailerOrientation);
      if (orientation === "north") {
        return a.position.y - b.position.y;
      }
      return b.position.x - a.position.x;
    });

    if (sortedWaiting.length !== parkingAssignments.length) {
      setStatus("Mismatch between waiting SlipBots and parking assignments. Reset and try again.");
      return;
    }

    const queue = sortedWaiting.map((bot, idx) => ({
      botId: bot.id,
      target: parkingAssignments[idx]
    }));

    const allInside = queue.every(entry =>
      areaContainsFootprint(
        allowedAreaRef.current,
        entry.target.position.x,
        entry.target.position.y,
        entry.target.orientation
      )
    );
    if (!allInside) {
      setStatus("All parking slots must remain inside the workspace.");
      return;
    }

    const anyBlocked = queue.some(entry => {
      const keys = collectFootprintKeys(
        entry.target.position.x,
        entry.target.position.y,
        entry.target.orientation
      );
      return keys.some(key => obstacleSetRef.current.has(key));
    });
    if (anyBlocked) {
      setStatus("Clear obstacles from each parking slot before launching the exit sequence.");
      return;
    }

    setStatus("Starting the SlipBot exit sequence.");
    runQueue(queue, 0);
  }, [isSequenceActive, parkingAssignments, runQueue, trailerOrientation]);

  const slipbotSummary = useMemo(
    () =>
      slipbots.map(bot => {
        const statusText =
          bot.status === "waiting" ? "Queued in trailer" : bot.status === "moving" ? "In motion" : "Parked";
        return { ...bot, statusText };
      }),
    [slipbots]
  );

  return (
    <div className="simulator-app">
      <header className="simulator-top-bar">
        <div className="top-bar-info">
          <h1>SlipBot Simulator</h1>
          <p>Plan a precise trailer exit inside a 200&nbsp;ft × 100&nbsp;ft yard.</p>
        </div>
        <div className="top-bar-actions">
          <button
            className="simulator-button secondary"
            onClick={handleClearParking}
            disabled={parkingAssignments.length === 0 || isSequenceActive}
          >
            Clear slots
          </button>
          <button className="simulator-button secondary" onClick={handleResetEnvironment}>
            Reset
          </button>
          <Link className="simulator-button secondary" to="/">
            Home
          </Link>
        </div>
      </header>
      <div className="simulator-body">
        <section className="workspace-area">
          <div className="workspace-controls">
            <div className="toggle-group">
              <span className="toggle-text">Workspace edit</span>
              <button
                type="button"
                className={`toggle-switch ${isDefiningArea ? "active" : ""}`}
                onClick={toggleWorkspaceMode}
                aria-pressed={isDefiningArea}
              >
                <span className="toggle-thumb" />
              </button>
              <span className="toggle-state">{isDefiningArea ? "Drag" : "Locked"}</span>
            </div>
            <span className="control-hint">Left click: parking slot • Right click: 1&nbsp;ft obstacle</span>
          </div>
          <div className="control-buttons">
            <button
              type="button"
              className={`simulator-button secondary ${isPlacingTrailer ? "active" : ""}`}
              onClick={toggleTrailerPlacement}
              aria-pressed={isPlacingTrailer}
              disabled={isSequenceActive}
            >
              Place trailer
            </button>
            <button
              type="button"
              className="simulator-button secondary"
              onClick={handleRotateTrailer}
              disabled={isSequenceActive}
            >
              Rotate trailer ({describeOrientation(trailerOrientation)})
            </button>
            <button
              type="button"
              className={`simulator-button secondary ${isAddingObstacleSlipbot ? "active" : ""}`}
              onClick={toggleObstacleSlipbotMode}
              aria-pressed={isAddingObstacleSlipbot}
              disabled={isSequenceActive}
            >
              Add SlipBot
            </button>
            <button
              type="button"
              className="simulator-button secondary"
              onClick={handleRotateObstacleOrientation}
              disabled={isSequenceActive}
            >
              Rotate SlipBot ({describeOrientation(obstacleSlipbotOrientation)})
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="simulator-canvas"
            width={canvasWidth}
            height={canvasHeight}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerLeave}
            onContextMenu={handleContextMenu}
          />
        </section>
        <aside className="control-panel">
          <div className="status-card">
            <h2>Status</h2>
            <p className="status-text">{status}</p>
          </div>
          <div className="metrics-grid">
            <div>
              <span className="label">Workspace origin</span>
              <span className="value">
                ({allowedArea.x}, {allowedArea.y})
              </span>
            </div>
            <div>
              <span className="label">Workspace size</span>
              <span className="value">
                {allowedArea.width} × {allowedArea.height} ft
              </span>
            </div>
            <div>
              <span className="label">Trailer origin</span>
              <span className="value">
                ({trailerOrigin.x}, {trailerOrigin.y})
              </span>
            </div>
            <div>
              <span className="label">Trailer orientation</span>
              <span className="value">{describeOrientation(trailerOrientation)}</span>
            </div>
            <div>
              <span className="label">Obstacles</span>
              <span className="value">{obstacleKeys.length}</span>
            </div>
            <div>
              <span className="label">Obstacle SlipBots</span>
              <span className="value">{obstacleSlipbots.length}</span>
            </div>
            <div>
              <span className="label">Parking slots</span>
              <span className="value">{parkingAssignments.length} / 3</span>
            </div>
            <div>
              <span className="label">SlipBot obstacle</span>
              <span className="value">{describeOrientation(obstacleSlipbotOrientation)}</span>
            </div>
          </div>
          <div className="queue-card">
            <h3>SlipBot queue</h3>
            <ul className="slipbot-list">
              {slipbotSummary.map(bot => (
                <li key={bot.id} className="slipbot-list-item">
                  <span className="slipbot-swatch" style={{ background: bot.color }} />
                  <div>
                    <div className="slipbot-name">{bot.name}</div>
                    <div className="slipbot-status">{bot.statusText}</div>
                    <div className="slipbot-position">
                      ({bot.position.x.toFixed(1)}, {bot.position.y.toFixed(1)})
                    </div>
                    <div className="slipbot-orientation">Heading {describeOrientation(bot.orientation)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <button
            className="simulator-button launch"
            onClick={handleExitSlipbots}
            disabled={parkingAssignments.length !== 3 || isSequenceActive}
          >
            Exit SlipBots
          </button>
        </aside>
      </div>
    </div>
  );
}

export default SimulatorV2;
