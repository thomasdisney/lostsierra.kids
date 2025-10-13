import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./SimulatorV2.css";

const GRID_WIDTH = 100;
const GRID_HEIGHT = 200;
const CELL_SIZE = 6;
const SLIPBOT_WIDTH = 8;
const SLIPBOT_HEIGHT = 17;
const ANIMATION_DELAY_MS = 220;

const DEFAULT_ALLOWED_AREA = {
  x: 1,
  y: 1,
  width: GRID_WIDTH - 2,
  height: GRID_HEIGHT - 2
};

const SLIPBOT_COUNT = 3;
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

function forEachFootprintCell(x, y, callback) {
  for (let dx = 0; dx < SLIPBOT_WIDTH; dx += 1) {
    for (let dy = 0; dy < SLIPBOT_HEIGHT; dy += 1) {
      callback(x + dx, y + dy);
    }
  }
}

function collectFootprintKeys(x, y) {
  const keys = [];
  forEachFootprintCell(x, y, (fx, fy) => {
    keys.push(pointKey(fx, fy));
  });
  return keys;
}

function areaContainsFootprint(area, x, y) {
  if (!area) return false;
  const withinX = x >= area.x && x + SLIPBOT_WIDTH <= area.x + area.width;
  const withinY = y >= area.y && y + SLIPBOT_HEIGHT <= area.y + area.height;
  return withinX && withinY;
}

function footprintWithinGrid(x, y) {
  return x >= 0 && y >= 0 && x + SLIPBOT_WIDTH <= GRID_WIDTH && y + SLIPBOT_HEIGHT <= GRID_HEIGHT;
}

function isFootprintFree(x, y, area, blockedSet) {
  if (!footprintWithinGrid(x, y)) return false;
  if (!areaContainsFootprint(area, x, y)) return false;
  let free = true;
  forEachFootprintCell(x, y, (cx, cy) => {
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

function heuristic(a, b) {
  const ax = a.x + SLIPBOT_WIDTH / 2;
  const ay = a.y + SLIPBOT_HEIGHT / 2;
  const bx = b.x + SLIPBOT_WIDTH / 2;
  const by = b.y + SLIPBOT_HEIGHT / 2;
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function planAStar(start, goal, area, blockedSet) {
  if (!start || !goal) return null;
  if (!isFootprintFree(goal.x, goal.y, area, blockedSet)) return null;
  if (!isFootprintFree(start.x, start.y, area, blockedSet)) return null;

  const startKey = pointKey(start.x, start.y);
  const goalKey = pointKey(goal.x, goal.y);

  const openMap = new Map([[startKey, { ...start }]]);
  const cameFrom = new Map();
  const nodeLookup = new Map([[startKey, { ...start }]]);
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, heuristic(start, goal)]]);
  const closedSet = new Set();

  const maxIterations = GRID_WIDTH * GRID_HEIGHT * 10;
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

    for (const { dx, dy } of DIRECTIONS) {
      const neighbor = { x: currentNode.x + dx, y: currentNode.y + dy };
      if (!footprintWithinGrid(neighbor.x, neighbor.y)) continue;
      if (!isFootprintFree(neighbor.x, neighbor.y, area, blockedSet)) continue;

      const neighborKey = pointKey(neighbor.x, neighbor.y);
      if (closedSet.has(neighborKey)) continue;

      const tentativeG = currentG + 1;
      const neighborG = gScore.get(neighborKey);

      if (neighborG === undefined || tentativeG < neighborG) {
        cameFrom.set(neighborKey, currentKey);
        nodeLookup.set(neighborKey, neighbor);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + heuristic(neighbor, goal));
        openMap.set(neighborKey, neighbor);
      }
    }
  }

  return null;
}

const DEFAULT_TRAILER_ORIGIN = { x: TRAILER_DEFAULT_X, y: TRAILER_DEFAULT_Y };

function createInitialSlipbots(origin = DEFAULT_TRAILER_ORIGIN) {
  return [
    {
      id: "slipbot-1",
      name: "SlipBot A",
      color: "#38bdf8",
      position: { x: origin.x, y: origin.y },
      status: "waiting"
    },
    {
      id: "slipbot-2",
      name: "SlipBot B",
      color: "#22c55e",
      position: { x: origin.x, y: origin.y + SLIPBOT_HEIGHT },
      status: "waiting"
    },
    {
      id: "slipbot-3",
      name: "SlipBot C",
      color: "#f97316",
      position: { x: origin.x, y: origin.y + 2 * SLIPBOT_HEIGHT },
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
  const [hoverCell, setHoverCell] = useState(null);
  const [slipbots, setSlipbots] = useState(() => createInitialSlipbots());
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
      forEachFootprintCell(item.position.x, item.position.y, (fx, fy) => {
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

  const canvasWidth = useMemo(() => GRID_WIDTH * CELL_SIZE, []);
  const canvasHeight = useMemo(() => GRID_HEIGHT * CELL_SIZE, []);

  const clearAnimation = useCallback(() => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
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

  const clampTopLeft = useCallback(
    cell => {
      if (!cell) return null;
      const area = draftArea ?? allowedArea;
      if (!area) return null;
      const maxX = area.x + area.width - SLIPBOT_WIDTH;
      const maxY = area.y + area.height - SLIPBOT_HEIGHT;
      const clampedX = Math.max(area.x, Math.min(cell.x, maxX));
      const clampedY = Math.max(area.y, Math.min(cell.y, maxY));
      return { x: clampedX, y: clampedY };
    },
    [allowedArea, draftArea]
  );

  const clampTrailerOrigin = useCallback(cell => {
    if (!cell) return null;
    const maxX = GRID_WIDTH - SLIPBOT_WIDTH - TRAILER_CLEARANCE;
    const maxY = GRID_HEIGHT - SLIPBOT_HEIGHT * SLIPBOT_COUNT - TRAILER_CLEARANCE;
    const clampedX = Math.max(TRAILER_CLEARANCE, Math.min(cell.x, maxX));
    const clampedY = Math.max(TRAILER_CLEARANCE, Math.min(cell.y, maxY));
    return { x: clampedX, y: clampedY };
  }, []);

  const clampObstacleSlipbot = useCallback(
    cell => {
      if (!cell) return null;
      const area = draftArea ?? allowedArea;
      if (!area) return null;
      const maxX = area.x + area.width - SLIPBOT_WIDTH;
      const maxY = area.y + area.height - SLIPBOT_HEIGHT;
      const clampedX = Math.max(area.x, Math.min(cell.x, maxX));
      const clampedY = Math.max(area.y, Math.min(cell.y, maxY));
      return { x: clampedX, y: clampedY };
    },
    [allowedArea, draftArea]
  );

  const handlePointerDown = useCallback(
    event => {
      if (isSequenceActive) return;
      if (event.button !== 0) return;
      const cell = getCellFromEvent(event);
      if (!cell) return;

      if (isPlacingTrailer) {
        const origin = clampTrailerOrigin(cell);
        if (!origin || !allowedArea) return;
        const staged = createInitialSlipbots(origin);
        const insideWorkspace = staged.every(bot =>
          areaContainsFootprint(allowedArea, bot.position.x, bot.position.y)
        );
        if (!insideWorkspace) {
          setStatus("Trailer must be positioned within the workspace bounds.");
          return;
        }
        const trailerFootprints = staged.flatMap(bot => collectFootprintKeys(bot.position.x, bot.position.y));
        const overlapsObstacles = trailerFootprints.some(
          key => obstacleSet.has(key) || obstacleSlipbotSet.has(key)
        );
        if (overlapsObstacles) {
          setStatus("Trailer placement overlaps an existing obstacle. Choose a clear spot.");
          return;
        }
        const parkingFootprints = parkingAssignments.flatMap(assignment =>
          collectFootprintKeys(assignment.position.x, assignment.position.y)
        );
        const overlapsParking = trailerFootprints.some(key => parkingFootprints.includes(key));
        if (overlapsParking) {
          setStatus("Trailer cannot overlap a planned parking slot.");
          return;
        }
        setTrailerOrigin(origin);
        setSlipbots(staged);
        slipbotsRef.current = staged;
        setTrailerPreview(null);
        setIsPlacingTrailer(false);
        setStatus(`Trailer positioned at (${origin.x}, ${origin.y}). SlipBots staged nose to tail.`);
        return;
      }

      if (isAddingObstacleSlipbot) {
        if (!allowedArea) return;
        const origin = clampObstacleSlipbot(cell);
        if (!origin) return;
        if (!areaContainsFootprint(allowedArea, origin.x, origin.y)) {
          setStatus("Obstacle SlipBots must be inside the workspace.");
          return;
        }
        const candidateKeys = collectFootprintKeys(origin.x, origin.y);
        const slipbotKeys = new Set();
        slipbotsRef.current.forEach(bot => {
          collectFootprintKeys(bot.position.x, bot.position.y).forEach(key => slipbotKeys.add(key));
        });
        const parkingKeys = new Set();
        parkingAssignments.forEach(assignment => {
          collectFootprintKeys(assignment.position.x, assignment.position.y).forEach(key => parkingKeys.add(key));
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
            position: origin
          }
        ]);
        setObstacleSlipbotPreview(null);
        setStatus(`Obstacle SlipBot added at (${origin.x}, ${origin.y}).`);
        return;
      }

      if (isDefiningArea) {
        areaAnchorRef.current = cell;
        setDraftArea({ x: cell.x, y: cell.y, width: 1, height: 1 });
        setStatus("Drag to size the allowable workspace.");
        return;
      }

      if (parkingAssignments.length >= 3) {
        setStatus("Parking slots already defined. Clear them to choose new targets.");
        return;
      }

      if (!allowedArea) return;
      const insideX = cell.x >= allowedArea.x && cell.x < allowedArea.x + allowedArea.width;
      const insideY = cell.y >= allowedArea.y && cell.y < allowedArea.y + allowedArea.height;
      if (!insideX || !insideY) {
        setStatus("Parking targets must be inside the workspace.");
        return;
      }

      const targetTopLeft = clampTopLeft(cell);
      if (!targetTopLeft) return;
      if (!areaContainsFootprint(allowedArea, targetTopLeft.x, targetTopLeft.y)) {
        setStatus("Parking targets must be fully inside the workspace.");
        return;
      }

      const candidateKeys = collectFootprintKeys(targetTopLeft.x, targetTopLeft.y);
      const slipbotKeys = new Set();
      slipbotsRef.current.forEach(bot => {
        collectFootprintKeys(bot.position.x, bot.position.y).forEach(key => slipbotKeys.add(key));
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
        const ax = assignment.position.x;
        const ay = assignment.position.y;
        return !(
          targetTopLeft.x + SLIPBOT_WIDTH <= ax ||
          ax + SLIPBOT_WIDTH <= targetTopLeft.x ||
          targetTopLeft.y + SLIPBOT_HEIGHT <= ay ||
          ay + SLIPBOT_HEIGHT <= targetTopLeft.y
        );
      });

      if (overlappingExisting) {
        setStatus("Parking slots cannot overlap.");
        return;
      }

      const newAssignments = [
        ...parkingAssignments,
        { id: `slot-${parkingAssignments.length + 1}`, position: targetTopLeft }
      ];
      setParkingAssignments(newAssignments);
      setStatus(`Parking slot ${newAssignments.length} positioned at (${targetTopLeft.x}, ${targetTopLeft.y}).`);
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
      if (isDefiningArea) {
        if (!cell || !areaAnchorRef.current) return;
        const workspace = computeWorkspaceFromCell(cell);
        if (workspace) {
          setDraftArea(workspace);
        }
        return;
      }

      if (isPlacingTrailer) {
        setTrailerPreview(cell ? clampTrailerOrigin(cell) : null);
        return;
      }

      if (isAddingObstacleSlipbot) {
        setObstacleSlipbotPreview(cell ? clampObstacleSlipbot(cell) : null);
        return;
      }

      if (!isSequenceActive && parkingAssignments.length < 3) {
        setHoverCell(cell ? clampTopLeft(cell) : null);
      } else {
        setHoverCell(null);
      }
    },
    [
      clampTopLeft,
      clampTrailerOrigin,
      clampObstacleSlipbot,
      computeWorkspaceFromCell,
      getCellFromEvent,
      isAddingObstacleSlipbot,
      isDefiningArea,
      isPlacingTrailer,
      isSequenceActive,
      parkingAssignments.length
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
        areaContainsFootprint(workspace, bot.position.x, bot.position.y)
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
          areaContainsFootprint(workspace, item.position.x, item.position.y)
        )
      );
      setParkingAssignments(prev =>
        prev.filter(assignment => areaContainsFootprint(workspace, assignment.position.x, assignment.position.y))
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
  }, [draftArea, finalizeWorkspace, isDefiningArea]);

  const handlePointerLeave = useCallback(() => {
    setHoverCell(null);
    setTrailerPreview(null);
    setObstacleSlipbotPreview(null);
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

      const conflictsSlipbot = slipbotsRef.current.some(bot =>
        x >= bot.position.x &&
        x < bot.position.x + SLIPBOT_WIDTH &&
        y >= bot.position.y &&
        y < bot.position.y + SLIPBOT_HEIGHT
      );
      if (conflictsSlipbot) {
        setStatus("Cannot place an obstacle on top of a SlipBot.");
        return;
      }

      const conflictsSlipbotObstacle = obstacleSlipbots.some(bot =>
        x >= bot.position.x &&
        x < bot.position.x + SLIPBOT_WIDTH &&
        y >= bot.position.y &&
        y < bot.position.y + SLIPBOT_HEIGHT
      );
      if (conflictsSlipbotObstacle) {
        setStatus("Cannot place an obstacle on top of a SlipBot obstacle.");
        return;
      }

      const conflictsParking = parkingAssignments.some(assignment =>
        x >= assignment.position.x &&
        x < assignment.position.x + SLIPBOT_WIDTH &&
        y >= assignment.position.y &&
        y < assignment.position.y + SLIPBOT_HEIGHT
      );
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
        setStatus("Click on the canvas to position the trailer. SlipBots will align nose to tail.");
      } else {
        setStatus("Trailer placement mode exited.");
        setTrailerPreview(null);
      }
      return next;
    });
  }, [isSequenceActive]);

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
        setStatus("Click inside the workspace to add a stationary SlipBot obstacle.");
      } else {
        setStatus("SlipBot obstacle placement mode exited.");
        setObstacleSlipbotPreview(null);
      }
      return next;
    });
  }, [isSequenceActive]);

  const handleClearParking = useCallback(() => {
    if (isSequenceActive) return;
    setParkingAssignments([]);
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
    setHoverCell(null);
    const resetBots = createInitialSlipbots();
    setSlipbots(resetBots);
    slipbotsRef.current = resetBots;
    setTrailerOrigin(DEFAULT_TRAILER_ORIGIN);
    setTrailerPreview(null);
    setObstacleSlipbotPreview(null);
    setIsPlacingTrailer(false);
    setIsAddingObstacleSlipbot(false);
    setSequenceState({ running: false, activeBotId: null, queueIndex: -1 });
    setCurrentPath([]);
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

    const renderTrailerBounds = (origin, options = {}) => {
      if (!origin) return;
      const padding = options.padding ?? TRAILER_CLEARANCE;
      const alpha = options.alpha ?? 0.12;
      const strokeAlpha = options.strokeAlpha ?? 0.5;
      const topLeftX = (origin.x - padding) * CELL_SIZE;
      const topLeftY = (origin.y - padding) * CELL_SIZE;
      const width = (SLIPBOT_WIDTH + padding * 2) * CELL_SIZE;
      const height = (SLIPBOT_HEIGHT * SLIPBOT_COUNT + padding * 2) * CELL_SIZE;
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
          SLIPBOT_WIDTH * CELL_SIZE,
          SLIPBOT_HEIGHT * SLIPBOT_COUNT * CELL_SIZE
        );
        ctx.restore();
      }
    };

    renderTrailerBounds(trailerOrigin, { padding: TRAILER_CLEARANCE, alpha: 0.08, strokeAlpha: 0.38 });
    if (trailerPreview) {
      renderTrailerBounds(trailerPreview, { padding: TRAILER_CLEARANCE, alpha: 0.18, strokeAlpha: 0.6, dashed: true });
    }

    ctx.fillStyle = "rgba(248, 113, 113, 0.6)";
    obstacleKeys.forEach(key => {
      const [ox, oy] = key.split(",").map(Number);
      ctx.fillRect(ox * CELL_SIZE, oy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    obstacleSlipbots.forEach((bot, index) => {
      ctx.fillStyle = "rgba(148, 163, 184, 0.28)";
      ctx.fillRect(
        bot.position.x * CELL_SIZE,
        bot.position.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
      ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        bot.position.x * CELL_SIZE,
        bot.position.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
      ctx.fillStyle = "rgba(226, 232, 240, 0.88)";
      ctx.font = "13px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `Obs ${index + 1}`,
        bot.position.x * CELL_SIZE + (SLIPBOT_WIDTH * CELL_SIZE) / 2,
        bot.position.y * CELL_SIZE + (SLIPBOT_HEIGHT * CELL_SIZE) / 2
      );
    });

    if (obstacleSlipbotPreview) {
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        obstacleSlipbotPreview.x * CELL_SIZE,
        obstacleSlipbotPreview.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
      ctx.restore();
    }

    parkingAssignments.forEach((assignment, index) => {
      ctx.fillStyle = "rgba(34, 197, 94, 0.22)";
      ctx.fillRect(
        assignment.position.x * CELL_SIZE,
        assignment.position.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
      ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        assignment.position.x * CELL_SIZE,
        assignment.position.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
      ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
      ctx.font = "16px 'Inter', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        `Slot ${index + 1}`,
        assignment.position.x * CELL_SIZE + 8,
        assignment.position.y * CELL_SIZE + 6
      );
    });

    if (hoverCell && parkingAssignments.length < 3 && !isSequenceActive) {
      ctx.fillStyle = "rgba(250, 204, 21, 0.18)";
      ctx.fillRect(
        hoverCell.x * CELL_SIZE,
        hoverCell.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
      ctx.strokeStyle = "rgba(250, 204, 21, 0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoverCell.x * CELL_SIZE,
        hoverCell.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
    }

    if (currentPath.length > 1) {
      const activeBot = slipbotsRef.current.find(bot => bot.id === sequenceState.activeBotId);
      ctx.strokeStyle = activeBot ? activeBot.color : "#38bdf8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      currentPath.forEach((step, idx) => {
        const cx = step.x * CELL_SIZE + (SLIPBOT_WIDTH * CELL_SIZE) / 2;
        const cy = step.y * CELL_SIZE + (SLIPBOT_HEIGHT * CELL_SIZE) / 2;
        if (idx === 0) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      });
      ctx.stroke();
    }

    slipbots.forEach(bot => {
      ctx.fillStyle = `${bot.color}cc`;
      ctx.fillRect(
        bot.position.x * CELL_SIZE,
        bot.position.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
      ctx.strokeStyle = bot.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(
        bot.position.x * CELL_SIZE,
        bot.position.y * CELL_SIZE,
        SLIPBOT_WIDTH * CELL_SIZE,
        SLIPBOT_HEIGHT * CELL_SIZE
      );
      ctx.fillStyle = "#0f172a";
      ctx.font = "15px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        bot.name.replace("SlipBot ", ""),
        bot.position.x * CELL_SIZE + (SLIPBOT_WIDTH * CELL_SIZE) / 2,
        bot.position.y * CELL_SIZE + (SLIPBOT_HEIGHT * CELL_SIZE) / 2
      );
    });
  }, [
    allowedArea,
    canvasHeight,
    canvasWidth,
    currentPath,
    draftArea,
    hoverCell,
    isSequenceActive,
    obstacleKeys,
    obstacleSlipbotPreview,
    obstacleSlipbots,
    parkingAssignments,
    sequenceState.activeBotId,
    slipbots,
    trailerOrigin,
    trailerPreview
  ]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  const buildBlockedSetForBot = useCallback(botId => {
    const blocked = new Set(obstacleSetRef.current);
    obstacleSlipbotSetRef.current.forEach(key => blocked.add(key));
    slipbotsRef.current.forEach(bot => {
      if (bot.id === botId) return;
      forEachFootprintCell(bot.position.x, bot.position.y, (bx, by) => {
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
      let index = 1;
      const step = () => {
        const nextPoint = path[index];
        setSlipbots(prev =>
          prev.map(bot =>
            bot.id === botId ? { ...bot, position: { x: nextPoint.x, y: nextPoint.y } } : bot
          )
        );
        index += 1;
        if (index < path.length) {
          animationRef.current = setTimeout(step, ANIMATION_DELAY_MS);
        } else {
          animationRef.current = null;
          onComplete();
        }
      };
      animationRef.current = setTimeout(step, ANIMATION_DELAY_MS);
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
      const path = planAStar(bot.position, entry.target.position, area, blocked);

      if (!path) {
        setSequenceState({ running: false, activeBotId: null, queueIndex: -1 });
        setCurrentPath([]);
        setStatus(
          `${bot.name} could not find a path to its parking slot. Adjust the workspace or obstacles and try again.`
        );
        return;
      }

      setSequenceState({ running: true, activeBotId: bot.id, queueIndex: index });
      setCurrentPath(path);
      setSlipbots(prev => prev.map(item => (item.id === bot.id ? { ...item, status: "moving" } : item)));
      setStatus(`${bot.name} is exiting the trailer and navigating to slot ${index + 1}.`);

      animateSlipbot(bot.id, path, () => {
        setSlipbots(prev =>
          prev.map(item =>
            item.id === bot.id
              ? { ...item, position: entry.target.position, status: "parked" }
              : item
          )
        );
        setCurrentPath([]);
        setStatus(`${bot.name} parked successfully.`);
        runQueue(queue, index + 1);
      });
    },
    [animateSlipbot, buildBlockedSetForBot]
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

    const queue = [...slipbotsRef.current]
      .sort((a, b) => a.position.x - b.position.x)
      .map((bot, idx) => ({ botId: bot.id, target: parkingAssignments[idx] }));

    const allInside = queue.every(entry =>
      areaContainsFootprint(allowedAreaRef.current, entry.target.position.x, entry.target.position.y)
    );
    if (!allInside) {
      setStatus("All parking slots must remain inside the workspace.");
      return;
    }

    const anyBlocked = queue.some(entry => {
      const keys = collectFootprintKeys(entry.target.position.x, entry.target.position.y);
      return keys.some(key => obstacleSetRef.current.has(key));
    });
    if (anyBlocked) {
      setStatus("Clear obstacles from each parking slot before launching the exit sequence.");
      return;
    }

    setStatus("Starting the SlipBot exit sequence.");
    runQueue(queue, 0);
  }, [isSequenceActive, parkingAssignments, runQueue]);

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
    <div className="simulator-wrapper">
      <div className="simulator-header">
        <h1>SlipBot Simulator V2</h1>
        <p>
          Configure a workspace, sprinkle in obstacles, and watch three SlipBots exit the trailer one at a time to their
          assigned parking slots. Each SlipBot is 17&nbsp;ft × 8&nbsp;ft and must avoid obstacles, walls, and the other
          robots.
        </p>
      </div>
      <div className="simulator-layout">
        <div className="canvas-container">
          <div className="canvas-toolbar">
            <div className="toolbar-row">
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
              <span className="grid-note">Left click: parking slot • Right click: 1&nbsp;ft obstacle</span>
            </div>
            <div className="toolbar-actions">
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
                className={`simulator-button secondary ${isAddingObstacleSlipbot ? "active" : ""}`}
                onClick={toggleObstacleSlipbotMode}
                aria-pressed={isAddingObstacleSlipbot}
                disabled={isSequenceActive}
              >
                Add SlipBot
              </button>
            </div>
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
          <div className="canvas-footer">
            <button className="simulator-button" onClick={handleResetEnvironment}>
              Reset environment
            </button>
            <button
              className="simulator-button secondary"
              onClick={handleClearParking}
              disabled={parkingAssignments.length === 0 || isSequenceActive}
            >
              Clear parking slots
            </button>
            <Link className="simulator-button secondary" to="/">
              Back to home
            </Link>
          </div>
        </div>
        <aside className="simulator-sidebar">
          <h2>Planner status</h2>
          <p className="status-text">{status}</p>
          <div className="info-grid">
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
          </div>
          <div className="slipbot-panel">
            <h3>SlipBot queue</h3>
            <ul className="slipbot-list">
              {slipbotSummary.map(bot => (
                <li key={bot.id} className="slipbot-list-item">
                  <span className="slipbot-swatch" style={{ background: bot.color }} />
                  <div>
                    <div className="slipbot-name">{bot.name}</div>
                    <div className="slipbot-status">{bot.statusText}</div>
                    <div className="slipbot-position">
                      ({bot.position.x}, {bot.position.y})
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="hint-panel">
            <h3>How to use</h3>
            <ul>
              <li>Toggle workspace edit to drag out the allowed operating area. Dimensions are shown as you size it.</li>
              <li>Use <strong>Place trailer</strong> to reposition the staged SlipBots. Click once inside the workspace to park the trailer nose to tail.</li>
              <li>Use <strong>Add SlipBot</strong> to drop stationary SlipBot obstacles for path-planning experiments.</li>
              <li>Right-click within the workspace to drop 1&nbsp;ft obstacles that SlipBots must avoid.</li>
              <li>Left-click inside the workspace to define three parking slots sized for a 17&nbsp;ft × 8&nbsp;ft SlipBot.</li>
              <li>Once slots are ready, launch the exit sequence. SlipBots leave the trailer closest-first and avoid one another.</li>
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
