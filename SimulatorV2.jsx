import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./SimulatorV2.css";

const GRID_WIDTH = 20;
const GRID_HEIGHT = 14;
const CELL_SIZE = 40;
const ANIMATION_DELAY_MS = 220;
const EPSILON = 1e-6;
const TOGGLE_STATUS_MESSAGE =
  "Obstacle updated. Adjust more or exit edit mode to command the Slipbot.";

function pointKey(x, y) {
  return `${x},${y}`;
}

class GridWorld {
  constructor(width, height, obstacles) {
    this.width = width;
    this.height = height;
    this.obstacles = new Set(obstacles ?? []);
  }

  isValid(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isFree(x, y) {
    if (!this.isValid(x, y)) return false;
    return !this.obstacles.has(pointKey(x, y));
  }

  getNeighbors(x, y) {
    const result = [];
    const directions = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0]
    ];

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isValid(nx, ny)) {
        result.push([nx, ny, 1]);
      }
    }

    return result;
  }
}

class DStarLitePlanner {
  constructor(world) {
    this.world = world;
    this.g = new Map();
    this.rhs = new Map();
    this.openList = [];
    this.openSet = new Set();
    this.km = 0;
    this.start = null;
    this.goal = null;
  }

  initialize(start, goal) {
    this.start = { ...start };
    this.goal = { ...goal };
    this.km = 0;
    this.openList = [];
    this.openSet = new Set();
    this.g.clear();
    this.rhs.clear();
    this.setRhs(this.goal, 0);
    const key = this.calculateKey(this.goal);
    this.openList.push({ key, state: { ...this.goal } });
    this.openSet.add(pointKey(this.goal.x, this.goal.y));
  }

  calculateKey(state) {
    const minVal = Math.min(this.getG(state), this.getRhs(state));
    return [minVal + this.heuristic(this.start, state) + this.km, minVal];
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  getG(state) {
    const key = pointKey(state.x, state.y);
    return this.g.has(key) ? this.g.get(key) : Infinity;
  }

  setG(state, value) {
    this.g.set(pointKey(state.x, state.y), value);
  }

  getRhs(state) {
    const key = pointKey(state.x, state.y);
    return this.rhs.has(key) ? this.rhs.get(key) : Infinity;
  }

  setRhs(state, value) {
    this.rhs.set(pointKey(state.x, state.y), value);
  }

  statesEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  keyLess(a, b) {
    if (a[0] < b[0] - EPSILON) return true;
    if (a[0] > b[0] + EPSILON) return false;
    return a[1] < b[1] - EPSILON;
  }

  nearlyEqual(a, b) {
    if (!isFinite(a) && !isFinite(b)) return true;
    return Math.abs(a - b) < EPSILON;
  }

  peekOpen() {
    let best = null;
    for (const entry of this.openList) {
      const key = pointKey(entry.state.x, entry.state.y);
      if (!this.openSet.has(key)) continue;
      if (!best || this.keyLess(entry.key, best.key)) {
        best = entry;
      }
    }
    return best;
  }

  extractMin() {
    let bestIndex = -1;
    let bestEntry = null;
    for (let i = 0; i < this.openList.length; i += 1) {
      const entry = this.openList[i];
      const key = pointKey(entry.state.x, entry.state.y);
      if (!this.openSet.has(key)) continue;
      if (!bestEntry || this.keyLess(entry.key, bestEntry.key)) {
        bestEntry = entry;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) {
      return null;
    }
    this.openList.splice(bestIndex, 1);
    this.openSet.delete(pointKey(bestEntry.state.x, bestEntry.state.y));
    return bestEntry;
  }

  updateVertex(state) {
    const keyStr = pointKey(state.x, state.y);

    if (!this.statesEqual(state, this.goal)) {
      let rhs = Infinity;
      for (const [nx, ny, cost] of this.world.getNeighbors(state.x, state.y)) {
        if (this.world.isFree(nx, ny)) {
          rhs = Math.min(rhs, cost + this.getG({ x: nx, y: ny }));
        }
      }
      this.setRhs(state, rhs);
    }

    if (this.openSet.has(keyStr)) {
      this.openSet.delete(keyStr);
    }

    if (!this.nearlyEqual(this.getG(state), this.getRhs(state))) {
      const key = this.calculateKey(state);
      this.openList.push({ key, state: { ...state } });
      this.openSet.add(keyStr);
    }
  }

  computeShortestPath() {
    const maxIterations = this.world.width * this.world.height * 100;
    let iterations = 0;

    while (true) {
      const top = this.peekOpen();
      const startKey = this.calculateKey(this.start);

      if (!top) {
        break;
      }

      if (!this.keyLess(top.key, startKey) && this.nearlyEqual(this.getRhs(this.start), this.getG(this.start))) {
        return { success: true, reason: "path_found" };
      }

      const current = this.extractMin();
      if (!current) {
        break;
      }

      iterations += 1;
      if (iterations > maxIterations) {
        return { success: false, reason: `max_iterations_exceeded (${maxIterations})` };
      }

      const { key: kOld, state } = current;
      const kNew = this.calculateKey(state);

      if (this.keyLess(kOld, kNew)) {
        this.openList.push({ key: kNew, state: { ...state } });
        this.openSet.add(pointKey(state.x, state.y));
      } else if (this.getG(state) > this.getRhs(state)) {
        this.setG(state, this.getRhs(state));
        for (const [nx, ny] of this.world.getNeighbors(state.x, state.y)) {
          if (this.world.isFree(nx, ny)) {
            this.updateVertex({ x: nx, y: ny });
          }
        }
      } else {
        this.setG(state, Infinity);
        this.updateVertex(state);
        for (const [nx, ny] of this.world.getNeighbors(state.x, state.y)) {
          if (this.world.isFree(nx, ny)) {
            this.updateVertex({ x: nx, y: ny });
          }
        }
      }
    }

    if (!isFinite(this.getG(this.start))) {
      return { success: false, reason: "no_path_exists" };
    }

    if (!this.nearlyEqual(this.getG(this.start), this.getRhs(this.start))) {
      return { success: false, reason: "inconsistent_state" };
    }

    return { success: true, reason: "path_found" };
  }

  getPath() {
    if (!isFinite(this.getG(this.start))) {
      return [];
    }

    const path = [{ ...this.start }];
    let current = { ...this.start };
    const maxSteps = this.world.width * this.world.height;

    for (let steps = 0; steps < maxSteps; steps += 1) {
      if (this.statesEqual(current, this.goal)) {
        return path;
      }

      let bestNeighbor = null;
      let bestCost = Infinity;

      for (const [nx, ny, cost] of this.world.getNeighbors(current.x, current.y)) {
        if (!this.world.isFree(nx, ny)) continue;
        const totalCost = cost + this.getG({ x: nx, y: ny });
        if (totalCost < bestCost - EPSILON) {
          bestCost = totalCost;
          bestNeighbor = { x: nx, y: ny };
        }
      }

      if (!bestNeighbor) {
        break;
      }

      path.push(bestNeighbor);
      current = bestNeighbor;
    }

    return path;
  }
}

function buildInitialObstacleRects() {
  const base = [
    { x: 6, y: 4, width: 7, height: 1 },
    { x: 12, y: 4, width: 1, height: 5 },
    { x: 9, y: 8, width: 3, height: 1 }
  ];
  let counter = 1;
  return base.map(rect => ({ ...rect, id: `ob-${counter++}` }));
}

function expandRectangles(rects) {
  const occupied = new Set();
  rects.forEach(rect => {
    for (let dx = 0; dx < rect.width; dx += 1) {
      for (let dy = 0; dy < rect.height; dy += 1) {
        const x = rect.x + dx;
        const y = rect.y + dy;
        occupied.add(pointKey(x, y));
      }
    }
  });
  return occupied;
}

function rectContains(rect, x, y) {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function computeBoundsFromAnchor(anchor, target) {
  const clampedX = Math.max(0, Math.min(GRID_WIDTH - 1, target.x));
  const clampedY = Math.max(0, Math.min(GRID_HEIGHT - 1, target.y));
  const minX = Math.min(anchor.x, clampedX);
  const minY = Math.min(anchor.y, clampedY);
  const maxX = Math.max(anchor.x, clampedX);
  const maxY = Math.max(anchor.y, clampedY);
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function SimulatorV2() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const robotPosRef = useRef({ x: 2, y: 2 });
  const targetRef = useRef(null);
  const robotImageRef = useRef(null);
  const editSessionRef = useRef(null);
  const pointerCellRef = useRef(null);
  const nextRectIdRef = useRef(buildInitialObstacleRects().length + 1);

  const [robotPosition, setRobotPosition] = useState(robotPosRef.current);
  const [target, setTarget] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [isMoving, setIsMoving] = useState(false);
  const [status, setStatus] = useState("Select a target cell to command the Slipbot.");
  const [obstacleRects, setObstacleRects] = useState(() => buildInitialObstacleRects());
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeRectId, setActiveRectId] = useState(null);
  const [robotImageLoaded, setRobotImageLoaded] = useState(false);

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

  useEffect(() => {
    const img = new Image();
    img.src = "/slipbot.png";
    img.onload = () => {
      robotImageRef.current = img;
      setRobotImageLoaded(true);
    };
    img.onerror = () => {
      robotImageRef.current = null;
      setRobotImageLoaded(false);
    };
    robotImageRef.current = img;
  }, []);

  useEffect(() => {
    robotPosRef.current = robotPosition;
  }, [robotPosition]);

  const animatePath = useCallback(
    path => {
      clearAnimation();
      setCurrentPath(path);

      if (!path || path.length <= 1) {
        setIsMoving(false);
        return;
      }

      setIsMoving(true);
      let index = 1;

      const step = () => {
        const nextPoint = path[index];
        setRobotPosition({ x: nextPoint.x, y: nextPoint.y });
        index += 1;
        if (index < path.length) {
          animationRef.current = setTimeout(step, ANIMATION_DELAY_MS);
        } else {
          animationRef.current = null;
          setIsMoving(false);
          setStatus("Arrived at target. Select a new destination or adjust obstacles.");
        }
      };

      animationRef.current = setTimeout(step, ANIMATION_DELAY_MS);
    },
    [clearAnimation]
  );

  const obstacleCells = useMemo(() => expandRectangles(obstacleRects), [obstacleRects]);

  const planPath = useCallback(
    (start, goal, options = { animate: true, silent: false }) => {
      const { animate = true, silent = false } = options;
      const world = new GridWorld(GRID_WIDTH, GRID_HEIGHT, obstacleCells);
      if (!world.isFree(goal.x, goal.y)) {
        setStatus("Target cell is blocked. Choose a free cell.");
        return [];
      }
      if (!world.isFree(start.x, start.y)) {
        setStatus("Robot is blocked by an obstacle. Clear the cell to move.");
        return [];
      }

      const planner = new DStarLitePlanner(world);
      planner.initialize(start, goal);
      const result = planner.computeShortestPath();

      if (!result.success) {
        setCurrentPath([]);
        if (!silent) {
          setStatus("No valid path found. Adjust obstacles and try again.");
        }
        return [];
      }

      const path = planner.getPath();
      if (path.length === 0) {
        setCurrentPath([]);
        if (!silent) {
          setStatus("No valid path found. Adjust obstacles and try again.");
        }
        return [];
      }

      if (path.length === 1) {
        clearAnimation();
        const single = path.map(({ x, y }) => ({ x, y }));
        setCurrentPath(single);
        setIsMoving(false);
        if (!silent) {
          setStatus("Slipbot is already at the goal. Choose another target to keep moving.");
        }
        return path;
      }

      if (!silent) {
        setStatus("Path planned using D* Lite. Executing movement...");
      }
      const normalized = path.map(({ x, y }) => ({ x, y }));
      if (animate) {
        animatePath(normalized);
      } else {
        setCurrentPath(normalized);
      }
      return path;
    },
    [animatePath, clearAnimation, obstacleCells]
  );

  const canvasWidth = useMemo(() => GRID_WIDTH * CELL_SIZE, []);
  const canvasHeight = useMemo(() => GRID_HEIGHT * CELL_SIZE, []);

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

  const setTargetCell = useCallback(
    cell => {
      if (!cell) return;
      const key = pointKey(cell.x, cell.y);
      if (obstacleCells.has(key)) {
        setStatus("Target cell is blocked. Choose a free cell.");
        return;
      }
      targetRef.current = { x: cell.x, y: cell.y };
      setTarget({ x: cell.x, y: cell.y });
      planPath(robotPosRef.current, { x: cell.x, y: cell.y }, { animate: true });
    },
    [obstacleCells, planPath]
  );

  const handlePointerDown = useCallback(
    event => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cell = getCellFromEvent(event);
      if (!cell) return;

      if (isEditMode) {
        canvas.setPointerCapture(event.pointerId);
        pointerCellRef.current = cell;
        const existingRect = obstacleRects.find(rect => rectContains(rect, cell.x, cell.y));
        if (existingRect) {
          editSessionRef.current = {
            rectId: existingRect.id,
            anchor: cell
          };
          setActiveRectId(existingRect.id);
        } else {
          const newRect = {
            id: `ob-${nextRectIdRef.current}`,
            x: cell.x,
            y: cell.y,
            width: 1,
            height: 1
          };
          nextRectIdRef.current += 1;
          setObstacleRects(prev => [...prev, newRect]);
          editSessionRef.current = {
            rectId: newRect.id,
            anchor: cell
          };
          setActiveRectId(newRect.id);
        }
        setStatus("Editing obstacles. Drag to stretch or shrink the selected block.");
      } else {
        setTargetCell(cell);
      }
    },
    [getCellFromEvent, isEditMode, obstacleRects, setTargetCell]
  );

  const handlePointerMove = useCallback(
    event => {
      if (!isEditMode) return;
      const session = editSessionRef.current;
      if (!session) return;

      const cell = getCellFromEvent(event);
      if (!cell) return;

      const previous = pointerCellRef.current;
      if (previous && previous.x === cell.x && previous.y === cell.y) {
        return;
      }

      pointerCellRef.current = cell;
      setObstacleRects(prev =>
        prev.map(rect => {
          if (rect.id !== session.rectId) return rect;
          return { ...rect, ...computeBoundsFromAnchor(session.anchor, cell) };
        })
      );
    },
    [getCellFromEvent, isEditMode]
  );

  const endEditSession = useCallback(() => {
    editSessionRef.current = null;
    pointerCellRef.current = null;
    setActiveRectId(null);
  }, []);

  const handlePointerUp = useCallback(
    event => {
      if (!isEditMode) return;
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (editSessionRef.current) {
        setObstacleRects(prev => prev.filter(rect => rect.width > 0 && rect.height > 0));
        setStatus(TOGGLE_STATUS_MESSAGE);
      }
      endEditSession();
    },
    [endEditSession, isEditMode]
  );

  const handlePointerLeave = useCallback(
    event => {
      if (!isEditMode) return;
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (editSessionRef.current) {
        setStatus(TOGGLE_STATUS_MESSAGE);
      }
      endEditSession();
    },
    [endEditSession, isEditMode]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_WIDTH; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_HEIGHT; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(canvasWidth, y * CELL_SIZE);
      ctx.stroke();
    }

    obstacleRects.forEach(rect => {
      const left = rect.x * CELL_SIZE;
      const top = rect.y * CELL_SIZE;
      const width = rect.width * CELL_SIZE;
      const height = rect.height * CELL_SIZE;

      ctx.fillStyle = "rgba(51, 65, 85, 0.9)";
      ctx.fillRect(left, top, width, height);

      const isActive = rect.id === activeRectId && isEditMode;
      ctx.strokeStyle = isActive ? "#38bdf8" : "rgba(148, 163, 184, 0.45)";
      ctx.lineWidth = isActive ? 3 : 1.8;
      ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);

      if (isEditMode) {
        ctx.font = "600 13px 'Inter', sans-serif";
        const lineHeight = 16;
        const lineOne = `${rect.width}ft × ${rect.height}ft`;
        const area = rect.width * rect.height;
        const lineTwo = `${area}ft²`;
        const metricsOne = ctx.measureText(lineOne);
        const metricsTwo = ctx.measureText(lineTwo);
        const textWidth = Math.max(metricsOne.width, metricsTwo.width);
        const paddingX = 8;
        const paddingY = 6;
        const boxWidth = textWidth + paddingX * 2;
        const boxHeight = lineHeight * 2 + paddingY * 2 - 6;
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        const boxLeft = centerX - boxWidth / 2;
        const boxTop = centerY - boxHeight / 2;

        ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
        ctx.fillRect(boxLeft, boxTop, boxWidth, boxHeight);
        ctx.strokeStyle = rect.id === activeRectId ? "#38bdf8" : "rgba(148, 163, 184, 0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(lineOne, centerX, centerY - lineHeight / 2);
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.fillText(lineTwo, centerX, centerY + lineHeight / 2);
      }
    });

    if (currentPath && currentPath.length > 1) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      currentPath.forEach(({ x, y }, index) => {
        const cx = x * CELL_SIZE + CELL_SIZE / 2;
        const cy = y * CELL_SIZE + CELL_SIZE / 2;
        if (index === 0) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      });
      ctx.stroke();
    }

    if (target) {
      ctx.fillStyle = "#f97316";
      const tx = target.x * CELL_SIZE + CELL_SIZE / 2;
      const ty = target.y * CELL_SIZE + CELL_SIZE / 2;
      ctx.beginPath();
      ctx.arc(tx, ty, CELL_SIZE * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const rx = robotPosition.x * CELL_SIZE + CELL_SIZE / 2;
    const ry = robotPosition.y * CELL_SIZE + CELL_SIZE / 2;
    const robotRadius = CELL_SIZE * 0.45;
    if (robotImageRef.current && (robotImageLoaded || robotImageRef.current.complete)) {
      const size = CELL_SIZE * 0.9;
      ctx.drawImage(robotImageRef.current, rx - size / 2, ry - size / 2, size, size);
    } else {
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(rx, ry, robotRadius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, robotRadius, 0, Math.PI * 2);
    ctx.stroke();
  }, [
    activeRectId,
    canvasHeight,
    canvasWidth,
    currentPath,
    isEditMode,
    obstacleRects,
    robotImageLoaded,
    robotPosition,
    target
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleContextMenu = event => {
      event.preventDefault();
    };
    canvas.addEventListener("contextmenu", handleContextMenu);
    return () => {
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!targetRef.current) return;
    planPath(robotPosRef.current, targetRef.current, { animate: false, silent: isEditMode });
    if (isEditMode) {
      setStatus("Editing obstacles. Drag to stretch or shrink the selected block.");
    }
  }, [isEditMode, planPath, obstacleCells]);

  const handleToggleEditMode = useCallback(() => {
    setIsEditMode(prev => {
      const next = !prev;
      if (!next) {
        editSessionRef.current = null;
        pointerCellRef.current = null;
        setActiveRectId(null);
        setStatus("Edit mode disabled. Select a target cell to command the Slipbot.");
      } else {
        setStatus("Edit mode enabled. Tap to place an obstacle, then drag to resize it.");
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    clearAnimation();
    const start = { x: 2, y: 2 };
    robotPosRef.current = start;
    setRobotPosition(start);
    setTarget(null);
    targetRef.current = null;
    setCurrentPath([]);
    const initialRects = buildInitialObstacleRects();
    setObstacleRects(initialRects);
    nextRectIdRef.current = initialRects.length + 1;
    setIsEditMode(false);
    setActiveRectId(null);
    setStatus("Environment reset. Select a target cell to command the Slipbot.");
  }, [clearAnimation]);

  return (
    <div className="simulator-wrapper">
      <div className="simulator-header">
        <h1>Slipbot Simulator V2</h1>
        <p>
          Powered by a D* Lite path planner adapted from the multi-robot playground. Use the edit switch to
          sculpt obstacles on the 1&nbsp;ft grid, then tap a target cell to command the Slipbot.
        </p>
      </div>
      <div className="simulator-layout">
        <div className="canvas-container">
          <div className="canvas-toolbar">
            <div className="toggle-group">
              <span className="toggle-text">Obstacle edit mode</span>
              <button
                type="button"
                className={`toggle-switch ${isEditMode ? "active" : ""}`}
                onClick={handleToggleEditMode}
                aria-pressed={isEditMode}
              >
                <span className="toggle-thumb" />
              </button>
              <span className="toggle-state">{isEditMode ? "On" : "Off"}</span>
            </div>
            <span className="grid-note">Each square represents 1&nbsp;ft × 1&nbsp;ft.</span>
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
          />
          <div className="canvas-footer">
            <button className="simulator-button" onClick={handleReset}>
              Reset environment
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
              <span className="label">Slipbot position</span>
              <span className="value">
                ({robotPosition.x}, {robotPosition.y})
              </span>
            </div>
            <div>
              <span className="label">Target</span>
              <span className="value">
                {target ? `(${target.x}, ${target.y})` : "—"}
              </span>
            </div>
            <div>
              <span className="label">Path length</span>
              <span className="value">{currentPath.length > 0 ? currentPath.length - 1 : 0} steps</span>
            </div>
            <div>
              <span className="label">Movement</span>
              <span className="value">{isMoving ? "Executing" : "Idle"}</span>
            </div>
          </div>
          <div className="hint-panel">
            <h3>How to use</h3>
            <ul>
              <li>Toggle edit mode to add, stretch, or shrink rectangular obstacles.</li>
              <li>Dimensions (length, width, and area) are shown while editing to help plan clearances.</li>
              <li>Disable edit mode and tap any free cell to set the goal target.</li>
              <li>The Slipbot replans instantly and can accept new destinations mid-move.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default SimulatorV2;
