import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SimulatorV2.css";

const WORLD_WIDTH = 220; // feet
const WORLD_HEIGHT = 120; // feet
const MIN_SCALE = 3;
const MAX_SCALE = 10;
const DEFAULT_SCALE = 6;

const ENTITY_TEMPLATES = {
  slipbot: {
    label: "SlipBot",
    length: 18,
    width: 8,
    color: "#6dcff6"
  },
  trailer: {
    label: "Trailer",
    length: 72,
    width: 12,
    color: "#94a3b8"
  },
  forklift: {
    label: "Forklift",
    length: 15,
    width: 7,
    color: "#fbbf24"
  },
  cart: {
    label: "Cart",
    length: 14,
    width: 8,
    color: "#22c55e"
  }
};

const GRID_GAP = 5;
const WAYPOINT_THRESHOLD = 0.75;
const DEFAULT_SPEED = 24; // feet per second

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
}

function createEntity(type) {
  const template = ENTITY_TEMPLATES[type];
  if (!template) throw new Error(`Unknown entity type: ${type}`);
  const center = {
    x: WORLD_WIDTH / 2 + (Math.random() - 0.5) * 20,
    y: WORLD_HEIGHT / 2 + (Math.random() - 0.5) * 20
  };
  return {
    id: createId(type),
    type,
    label: template.label,
    center,
    rotation: 0,
    length: template.length,
    width: template.width,
    color: template.color,
    route: [],
    speed: DEFAULT_SPEED
  };
}

function rotatePoint(point, center, rotation) {
  const radians = toRadians(rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function rectanglePolygon({ center, length, width, rotation }) {
  const halfL = length / 2;
  const halfW = width / 2;
  const corners = [
    { x: center.x - halfL, y: center.y - halfW },
    { x: center.x + halfL, y: center.y - halfW },
    { x: center.x + halfL, y: center.y + halfW },
    { x: center.x - halfL, y: center.y + halfW }
  ];
  return rotation === 0
    ? corners
    : corners.map(corner => rotatePoint(corner, center, rotation));
}

function polygonAxes(points) {
  const axes = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const edge = { x: next.x - current.x, y: next.y - current.y };
    const magnitude = Math.hypot(edge.x, edge.y) || 1;
    axes.push({ x: -edge.y / magnitude, y: edge.x / magnitude });
  }
  return axes;
}

function project(points, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const value = p.x * axis.x + p.y * axis.y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function polygonsOverlap(a, b) {
  const axes = [...polygonAxes(a), ...polygonAxes(b)];
  return axes.every(axis => {
    const projA = project(a, axis);
    const projB = project(b, axis);
    return projA.max > projB.min && projB.max > projA.min;
  });
}

function entityCollides(candidate, entities, obstacles, ignoreId) {
  const candidatePoly = rectanglePolygon(candidate);
  for (const entity of entities) {
    if (entity.id === ignoreId) continue;
    if (polygonsOverlap(candidatePoly, rectanglePolygon(entity))) {
      return true;
    }
  }
  for (const obstacle of obstacles) {
    const obstaclePoly = rectanglePolygon({ ...obstacle, rotation: 0 });
    if (polygonsOverlap(candidatePoly, obstaclePoly)) {
      return true;
    }
  }
  return false;
}

function clampToWorld(center, length, width, rotation) {
  const poly = rectanglePolygon({ center, length, width, rotation });
  const xs = poly.map(p => p.x);
  const ys = poly.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = Math.min(0, minX) + Math.min(0, WORLD_WIDTH - maxX);
  const dy = Math.min(0, minY) + Math.min(0, WORLD_HEIGHT - maxY);
  return { x: center.x + dx, y: center.y + dy };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function SlipbotShape({ entity, isSelected }) {
  const { center, length, width, rotation, color } = entity;
  const bodyRadius = Math.min(2, width / 3);
  const stroke = isSelected ? "#22d3ee" : "#0f172a";
  return (
    <g transform={`translate(${center.x}, ${center.y}) rotate(${rotation})`}>
      <rect
        x={-length / 2}
        y={-width / 2}
        width={length}
        height={width}
        rx={bodyRadius}
        ry={bodyRadius}
        fill={color}
        stroke={stroke}
        strokeWidth={0.6}
        opacity={0.95}
      />
      <rect
        x={-length / 2 + 1}
        y={-width / 2 + 1}
        width={length / 3}
        height={width - 2}
        rx={bodyRadius}
        fill="#0ea5e9"
        opacity={0.35}
      />
      <line x1={0} y1={-width / 2} x2={0} y2={width / 2} stroke="#0f172a" strokeDasharray="2 2" strokeWidth={0.8} />
      <polygon
        points={`${-length / 2 + 2},0 ${-length / 2 + 6},-2 ${-length / 2 + 6},2`}
        fill="#0f172a"
      />
    </g>
  );
}

function TrailerShape({ entity, isSelected }) {
  const { center, length, width, rotation, color } = entity;
  return (
    <g transform={`translate(${center.x}, ${center.y}) rotate(${rotation})`}>
      <rect
        x={-length / 2}
        y={-width / 2}
        width={length}
        height={width}
        fill={color}
        stroke={isSelected ? "#22d3ee" : "#0f172a"}
        strokeWidth={0.6}
        opacity={0.75}
      />
      <rect x={-length / 2 + 2} y={-width / 2 + 2} width={length - 4} height={width - 4} fill="#0f172a" opacity={0.15} />
      <line x1={length / 2 - 6} y1={-width / 2} x2={length / 2 - 6} y2={width / 2} stroke="#0f172a" strokeWidth={1} opacity={0.8} />
    </g>
  );
}

function ForkliftShape({ entity, isSelected }) {
  const { center, length, width, rotation, color } = entity;
  return (
    <g transform={`translate(${center.x}, ${center.y}) rotate(${rotation})`}>
      <rect
        x={-length / 2}
        y={-width / 2}
        width={length}
        height={width}
        rx={1.2}
        fill={color}
        stroke={isSelected ? "#22d3ee" : "#0f172a"}
        strokeWidth={0.6}
      />
      <rect x={length / 2 - 4} y={-width / 2 - 1} width={3.5} height={width + 2} fill="#1f2937" opacity={0.9} />
      <line x1={-length / 4} y1={-width / 2} x2={-length / 4} y2={width / 2} stroke="#f8fafc" strokeDasharray="1 1" strokeWidth={0.8} />
    </g>
  );
}

function CartShape({ entity, isSelected }) {
  const { center, length, width, rotation, color } = entity;
  return (
    <g transform={`translate(${center.x}, ${center.y}) rotate(${rotation})`}>
      <rect
        x={-length / 2}
        y={-width / 2}
        width={length}
        height={width}
        rx={1.6}
        fill={color}
        stroke={isSelected ? "#22d3ee" : "#0f172a"}
        strokeWidth={0.6}
        opacity={0.9}
      />
      <rect x={-length / 3} y={-width / 2 + 1} width={length / 1.5} height={width - 2} fill="#0f172a" opacity={0.18} />
    </g>
  );
}

function ObstacleShape({ obstacle }) {
  const { x, y, length, width } = obstacle;
  const areaCenter = { x: x + length / 2, y: y + width / 2 };
  const dimensionLabel = `${length.toFixed(2)}ft × ${width.toFixed(2)}ft`;
  return (
    <g transform={`translate(${areaCenter.x}, ${areaCenter.y})`}>
      <rect x={-length / 2} y={-width / 2} width={length} height={width} fill="rgba(244,63,94,0.18)" stroke="#f43f5e" strokeWidth={0.8} />
      <text x={-length / 2 + 1.2} y={-width / 2 - 1.2} className="obstacle-label">
        {dimensionLabel}
      </text>
    </g>
  );
}

const ENTITY_RENDERERS = {
  slipbot: SlipbotShape,
  trailer: TrailerShape,
  forklift: ForkliftShape,
  cart: CartShape
};

function SimulatorV2() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState(() => [createEntity("slipbot")]);
  const [obstacles, setObstacles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [draftObstacle, setDraftObstacle] = useState(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [background, setBackground] = useState(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const lastFrameRef = useRef(null);

  const selectedEntity = useMemo(() => entities.find(e => e.id === selectedId) || null, [entities, selectedId]);

  const addEntity = useCallback(type => {
    const newEntity = createEntity(type);
    setEntities(prev => [...prev, newEntity]);
    setSelectedId(newEntity.id);
  }, []);

  const removeEntity = useCallback(id => {
    setEntities(prev => prev.filter(entity => entity.id !== id));
    setSelectedId(current => (current === id ? null : current));
  }, []);

  const onMousePosition = useCallback(event => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const scaleX = WORLD_WIDTH / rect.width;
    const scaleY = WORLD_HEIGHT / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }, []);

  const handleObstacleStart = event => {
    const point = onMousePosition(event);
    if (!point) return;
    setDraftObstacle({ start: point, end: point });
  };

  const handleObstacleMove = event => {
    if (!draftObstacle) return;
    const point = onMousePosition(event);
    if (!point) return;
    setDraftObstacle(current => (current ? { ...current, end: point } : null));
  };

  const handleObstacleFinish = () => {
    if (!draftObstacle) return;
    const { start, end } = draftObstacle;
    const length = Math.abs(end.x - start.x);
    const width = Math.abs(end.y - start.y);
    if (length < 1 || width < 1) {
      setDraftObstacle(null);
      return;
    }
    const obstacle = {
      id: createId("obstacle"),
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      length,
      width
    };
    setObstacles(prev => [...prev, obstacle]);
    setDraftObstacle(null);
  };

  const updateEntity = useCallback((id, updater) => {
    setEntities(prev => prev.map(entity => (entity.id === id ? { ...entity, ...updater(entity) } : entity)));
  }, []);

  const handleEntityMouseDown = (event, entity) => {
    if (drawMode) return;
    event.stopPropagation();
    setSelectedId(entity.id);
    const point = onMousePosition(event);
    if (!point) return;
    dragRef.current = {
      id: entity.id,
      offset: { x: point.x - entity.center.x, y: point.y - entity.center.y }
    };
  };

  const handleMouseMove = event => {
    if (drawMode) {
      handleObstacleMove(event);
      return;
    }
    const dragState = dragRef.current;
    if (!dragState) return;
    const point = onMousePosition(event);
    if (!point) return;
    setEntities(prev => {
      return prev.map(entity => {
        if (entity.id !== dragState.id) return entity;
        const clampedCenter = clampToWorld(
          { x: point.x - dragState.offset.x, y: point.y - dragState.offset.y },
          entity.length,
          entity.width,
          entity.rotation
        );
        const candidate = { ...entity, center: clampedCenter };
        if (entityCollides(candidate, prev, obstacles, entity.id)) {
          return entity;
        }
        return candidate;
      });
    });
  };

  const handleMouseUp = () => {
    if (drawMode) {
      handleObstacleFinish();
    }
    dragRef.current = null;
  };

  const handleBackgroundUpload = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setBackground(e.target?.result || null);
    reader.readAsDataURL(file);
  };

  const handleAddWaypoint = event => {
    if (!selectedEntity) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    const point = onMousePosition(event);
    if (!point) return;
    setEntities(prev =>
      prev.map(entity =>
        entity.id === selectedEntity.id
          ? { ...entity, route: [...entity.route, { x: point.x, y: point.y }] }
          : entity
      )
    );
  };

  const tick = useCallback(
    timestamp => {
      if (lastFrameRef.current == null) {
        lastFrameRef.current = timestamp;
      }
      const delta = (timestamp - lastFrameRef.current) / 1000;
      lastFrameRef.current = timestamp;
      setEntities(prev =>
        prev.map(entity => {
          if (!entity.route.length) return entity;
          const target = entity.route[0];
          const step = entity.speed * delta;
          const heading = Math.atan2(target.y - entity.center.y, target.x - entity.center.x);
          const nextCenter = {
            x: entity.center.x + Math.cos(heading) * step,
            y: entity.center.y + Math.sin(heading) * step
          };
          const remaining = distance(entity.center, target);
          const newCenter = remaining <= step ? target : nextCenter;
          const desiredRotation = (heading * 180) / Math.PI;
          const candidate = {
            ...entity,
            center: clampToWorld(newCenter, entity.length, entity.width, desiredRotation),
            rotation: desiredRotation
          };
          if (entityCollides(candidate, prev, obstacles, entity.id)) {
            return { ...entity, route: [] };
          }
          const route = remaining <= WAYPOINT_THRESHOLD ? entity.route.slice(1) : entity.route;
          return { ...candidate, route };
        })
      );
    },
    [obstacles]
  );

  useEffect(() => {
    let frameId;
    const frame = timestamp => {
      tick(timestamp);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [tick]);

  const renderEntities = entities.map(entity => {
    const Renderer = ENTITY_RENDERERS[entity.type];
    if (!Renderer) return null;
    return (
      <g
        key={entity.id}
        className="draggable"
        onMouseDown={event => handleEntityMouseDown(event, entity)}
        onDoubleClick={() => removeEntity(entity.id)}
      >
        <Renderer entity={entity} isSelected={selectedId === entity.id} />
      </g>
    );
  });

  const renderRoutes = entities
    .filter(entity => entity.route.length)
    .map(entity => (
      <polyline
        key={`route-${entity.id}`}
        points={[entity.center, ...entity.route].map(p => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={entity.color}
        strokeDasharray="3 3"
        strokeWidth={0.8}
        opacity={0.8}
      />
    ));

  const draftRect = draftObstacle
    ? (() => {
        const { start, end } = draftObstacle;
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const length = Math.abs(end.x - start.x);
        const width = Math.abs(end.y - start.y);
        return { x, y, length, width };
      })()
    : null;

  return (
    <div className="sim-wrapper">
      <header className="sim-header">
        <button className="link" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="title">SlipBot Simulator V2</div>
        <div className="header-actions">
          <button className="link" onClick={() => navigate("/example-wms")}>WMS View</button>
          <button className="link" onClick={() => navigate("/dashboard")}>Dashboard</button>
        </div>
      </header>

      <section className="toolbar">
        <div className="button-group">
          <button onClick={() => addEntity("slipbot")}>Add SlipBot</button>
          <button onClick={() => addEntity("trailer")}>Add Trailer</button>
          <button onClick={() => addEntity("forklift")}>Add Forklift</button>
          <button onClick={() => addEntity("cart")}>Add Cart</button>
          <button className={drawMode ? "active" : ""} onClick={() => setDrawMode(v => !v)}>
            {drawMode ? "Drawing…" : "Draw"}
          </button>
        </div>
        <div className="controls">
          <label>
            Scale
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.5}
              value={scale}
              onChange={e => setScale(Number(e.target.value))}
            />
            <span className="chip">{scale.toFixed(1)} px/ft</span>
          </label>
          <label className="file-input">
            Upload Background
            <input type="file" accept="image/*" onChange={handleBackgroundUpload} />
          </label>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-inner">
          <div className="background" style={{ backgroundImage: background ? `url(${background})` : "none" }} />
          <svg
            ref={svgRef}
            className="world"
            viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
            style={{ width: WORLD_WIDTH * scale, height: WORLD_HEIGHT * scale }}
            onMouseDown={event => {
              if (drawMode) {
                handleObstacleStart(event);
              } else {
                setSelectedId(null);
              }
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleAddWaypoint}
          >
            <defs>
              <pattern id="grid" width={GRID_GAP} height={GRID_GAP} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_GAP} 0 L 0 0 0 ${GRID_GAP}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="url(#grid)" />

            {renderRoutes}
            {obstacles.map(obstacle => (
              <ObstacleShape key={obstacle.id} obstacle={obstacle} />
            ))}
            {draftRect ? (
              <rect
                x={draftRect.x}
                y={draftRect.y}
                width={draftRect.length}
                height={draftRect.width}
                fill="rgba(248,113,113,0.25)"
                stroke="#f87171"
                strokeWidth={0.7}
                strokeDasharray="2 2"
              />
            ) : null}
            {renderEntities}
          </svg>
        </div>
      </section>

      <section className="sidebar">
        <div className="panel">
          <h3>Selection</h3>
          {selectedEntity ? (
            <div className="panel-body">
              <div className="row">
                <span className="label">Type</span>
                <span>{selectedEntity.label}</span>
              </div>
              <div className="row">
                <span className="label">Position</span>
                <span>
                  {selectedEntity.center.x.toFixed(2)} ft, {selectedEntity.center.y.toFixed(2)} ft
                </span>
              </div>
              <div className="row">
                <span className="label">Rotation</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedEntity.rotation}
                  onChange={e =>
                    updateEntity(selectedEntity.id, () => ({ rotation: Number(e.target.value) % 360 }))
                  }
                />
              </div>
              <div className="row inline">
                <button onClick={() => removeEntity(selectedEntity.id)}>Remove</button>
                <button
                  onClick={() =>
                    setEntities(prev =>
                      prev.map(entity =>
                        entity.id === selectedEntity.id ? { ...entity, route: [] } : entity
                      )
                    )
                  }
                >
                  Clear Route
                </button>
              </div>
              <p className="hint">Ctrl/Cmd + click anywhere to add waypoints for automated movement.</p>
            </div>
          ) : (
            <p className="panel-body muted">Click an object to manage it.</p>
          )}
        </div>
        <div className="panel">
          <h3>Obstacles</h3>
          {obstacles.length === 0 ? (
            <p className="panel-body muted">Enable Draw to mark restricted areas.</p>
          ) : (
            <ul className="obstacle-list">
              {obstacles.map(obstacle => (
                <li key={obstacle.id}>
                  <span>
                    {obstacle.length.toFixed(1)} × {obstacle.width.toFixed(1)} ft
                  </span>
                  <button onClick={() => setObstacles(list => list.filter(item => item.id !== obstacle.id))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default SimulatorV2;
