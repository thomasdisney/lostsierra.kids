import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./SimulatorV2.css";

const GRID_WIDTH = 20;
const GRID_HEIGHT = 14;
const CELL_SIZE = 40;
const ANIMATION_DELAY_MS = 220;
const EPSILON = 1e-6;

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

function buildInitialObstacles() {
  const preset = [
    [6, 4],
    [7, 4],
    [8, 4],
    [9, 4],
    [10, 4],
    [11, 4],
    [12, 4],
    [12, 5],
    [12, 6],
    [12, 7],
    [12, 8],
    [11, 8],
    [10, 8],
    [9, 8]
  ];
  const initial = new Set();
  preset.forEach(([x, y]) => initial.add(pointKey(x, y)));
  return initial;
}

function SimulatorV2() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const robotPosRef = useRef({ x: 2, y: 2 });
  const targetRef = useRef(null);

  const [robotPosition, setRobotPosition] = useState(robotPosRef.current);
  const [target, setTarget] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [isMoving, setIsMoving] = useState(false);
  const [status, setStatus] = useState("Select a target cell to command the Slipbot.");
  const [obstacles, setObstacles] = useState(() => buildInitialObstacles());

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

  const planPath = useCallback(
    (start, goal, { animate } = { animate: true }) => {
      const world = new GridWorld(GRID_WIDTH, GRID_HEIGHT, obstacles);
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
        setStatus("No valid path found. Adjust obstacles and try again.");
        return [];
      }

      const path = planner.getPath();
      if (path.length === 0) {
        setCurrentPath([]);
        setStatus("No valid path found. Adjust obstacles and try again.");
        return [];
      }

      if (path.length === 1) {
        clearAnimation();
        const single = path.map(({ x, y }) => ({ x, y }));
        setCurrentPath(single);
        setIsMoving(false);
        setStatus("Slipbot is already at the goal. Choose another target to keep moving.");
        return path;
      }

      setStatus("Path planned using D* Lite. Executing movement...");
      const normalized = path.map(({ x, y }) => ({ x, y }));
      if (animate) {
        animatePath(normalized);
      } else {
        setCurrentPath(normalized);
      }
      return path;
    },
    [animatePath, clearAnimation, obstacles]
  );

  const canvasWidth = useMemo(() => GRID_WIDTH * CELL_SIZE, []);
  const canvasHeight = useMemo(() => GRID_HEIGHT * CELL_SIZE, []);

  const handleCanvasClick = useCallback(
    event => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((event.clientX ?? 0) - rect.left) / CELL_SIZE);
      const y = Math.floor(((event.clientY ?? 0) - rect.top) / CELL_SIZE);
      if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;

      const key = pointKey(x, y);
      if (event.shiftKey) {
        if (robotPosRef.current.x === x && robotPosRef.current.y === y) {
          setStatus("Cannot place an obstacle on the Slipbot.");
          return;
        }
        setObstacles(prev => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
            setStatus("Obstacle removed. Replanning...");
          } else {
            next.add(key);
            setStatus("Obstacle added. Replanning...");
          }
          return next;
        });
        return;
      }

      targetRef.current = { x, y };
      setTarget({ x, y });
      planPath(robotPosRef.current, { x, y }, { animate: true });
    },
    [planPath]
  );

  useEffect(() => {
    if (!targetRef.current) return;
    planPath(robotPosRef.current, targetRef.current, { animate: true });
  }, [obstacles, planPath]);

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

    ctx.fillStyle = "#334155";
    for (const key of obstacles) {
      const [ox, oy] = key.split(",").map(Number);
      ctx.fillRect(ox * CELL_SIZE, oy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

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
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(rx, ry, CELL_SIZE * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [canvasHeight, canvasWidth, currentPath, obstacles, robotPosition, target]);

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

  const handleReset = useCallback(() => {
    clearAnimation();
    const start = { x: 2, y: 2 };
    robotPosRef.current = start;
    setRobotPosition(start);
    setTarget(null);
    targetRef.current = null;
    setCurrentPath([]);
    setObstacles(buildInitialObstacles());
    setStatus("Environment reset. Select a target cell to command the Slipbot.");
  }, [clearAnimation]);

  return (
    <div className="simulator-wrapper">
      <div className="simulator-header">
        <h1>Slipbot Simulator V2</h1>
        <p>
          Powered by a D* Lite path planner adapted from the multi-robot playground. Use shift+click to
          toggle obstacles and left click to choose a destination.
        </p>
      </div>
      <div className="simulator-layout">
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            className="simulator-canvas"
            width={canvasWidth}
            height={canvasHeight}
            onClick={handleCanvasClick}
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
              <li>Left click on any free cell to set the goal target.</li>
              <li>The Slipbot immediately replans and follows the D* Lite path.</li>
              <li>Shift + click to add or remove obstacles and watch the live replanning.</li>
              <li>Click new destinations at any time—even mid-move—for continuous operation.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default SimulatorV2;
