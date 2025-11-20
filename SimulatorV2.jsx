import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SimulatorV2.css";

const WORLD_WIDTH = 220; // feet
const WORLD_HEIGHT = 120; // feet
const DEFAULT_SCALE = 6;

const ENTITY_TEMPLATES = {
  slipbot: {
    label: "SlipBot",
    length: 17,
    width: 8,
    color: "#6dcff6"
  },
  trailer: {
    label: "Trailer",
    length: 53,
    width: 8.5,
    color: "#94a3b8"
  }
};

const GRID_GAP = 5;
const WAYPOINT_THRESHOLD = 0.75;
const DEFAULT_SPEED = 24; // feet per second
const PARKING_SPOTS = [
  { id: "spot-a", center: { x: 60, y: 100 }, rotation: 0 },
  { id: "spot-b", center: { x: 95, y: 100 }, rotation: 0 },
  { id: "spot-c", center: { x: 130, y: 100 }, rotation: 0 }
];
const OBSTACLE_PADDING = 6;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
}

function createEntity(type, overrides = {}) {
  const template = ENTITY_TEMPLATES[type];
  if (!template) throw new Error(`Unknown entity type: ${type}`);
  const center =
    overrides.center || {
      x: WORLD_WIDTH / 2 + (Math.random() - 0.5) * 20,
      y: WORLD_HEIGHT / 2 + (Math.random() - 0.5) * 20
    };
  return {
    id: createId(type),
    type,
    label: template.label,
    center,
    rotation: overrides.rotation ?? 0,
    length: template.length,
    width: template.width,
    color: template.color,
    route: [],
    speed: DEFAULT_SPEED,
    parkingSpotId: overrides.parkingSpotId || null,
    status: overrides.status || "idle",
    attachedTo: null,
    finalRotation: null,
    trailerSlotIndex: null,
    attachedOffset: null
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

function rotateOffset(point, rotation) {
  const radians = toRadians(rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function worldPointFromLocal(localPoint, reference) {
  const rotated = rotateOffset(localPoint, reference.rotation);
  return { x: reference.center.x + rotated.x, y: reference.center.y + rotated.y };
}

function localPointFromWorld(worldPoint, reference) {
  const translated = { x: worldPoint.x - reference.center.x, y: worldPoint.y - reference.center.y };
  return rotateOffset(translated, -reference.rotation);
}

function lineIntersectsRect(a, b, rect, padding = 0) {
  const expanded = {
    x: rect.x - padding,
    y: rect.y - padding,
    length: rect.length + padding * 2,
    width: rect.width + padding * 2
  };
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  if (right < expanded.x || left > expanded.x + expanded.length || bottom < expanded.y || top > expanded.y + expanded.width) {
    return false;
  }

  const x1 = a.x;
  const y1 = a.y;
  const x2 = b.x;
  const y2 = b.y;

  const intersects = (px, py, qx, qy) => {
    const det = (qx - px) * (y1 - py) - (qy - py) * (x1 - px);
    const det2 = (qx - px) * (y2 - py) - (qy - py) * (x2 - px);
    return det * det2 <= 0;
  };

  const withinX = (expanded.x <= Math.max(x1, x2) && expanded.x + expanded.length >= Math.min(x1, x2));
  const withinY = (expanded.y <= Math.max(y1, y2) && expanded.y + expanded.width >= Math.min(y1, y2));

  const topEdge = intersects(expanded.x, expanded.y, expanded.x + expanded.length, expanded.y);
  const bottomEdge = intersects(expanded.x, expanded.y + expanded.width, expanded.x + expanded.length, expanded.y + expanded.width);
  const leftEdge = intersects(expanded.x, expanded.y, expanded.x, expanded.y + expanded.width);
  const rightEdge = intersects(expanded.x + expanded.length, expanded.y, expanded.x + expanded.length, expanded.y + expanded.width);

  return (withinX && withinY) && (topEdge || bottomEdge || leftEdge || rightEdge);
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

function ParkingSpotShadow({ spot }) {
  const length = ENTITY_TEMPLATES.slipbot.length + 1;
  const width = ENTITY_TEMPLATES.slipbot.width + 1;
  return (
    <g transform={`translate(${spot.center.x}, ${spot.center.y}) rotate(${spot.rotation})`}>
      <rect
        x={-length / 2}
        y={-width / 2}
        width={length}
        height={width}
        fill="rgba(148,163,184,0.12)"
        stroke="rgba(148,163,184,0.35)"
        strokeDasharray="4 2"
      />
      <text x={0} y={width / 2 + 2.5} className="parking-label" textAnchor="middle">
        Parking
      </text>
    </g>
  );
}

const ENTITY_RENDERERS = {
  slipbot: SlipbotShape,
  trailer: TrailerShape
};

function createInitialEntities() {
  const trailer = createEntity("trailer", { center: { x: 165, y: 60 } });
  const slipbots = PARKING_SPOTS.map(spot =>
    createEntity("slipbot", {
      center: { ...spot.center },
      rotation: spot.rotation,
      parkingSpotId: spot.id,
      status: "parked"
    })
  );
  return [trailer, ...slipbots];
}

function SimulatorV2() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState(() => createInitialEntities());
  const [obstacles, setObstacles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [draftObstacle, setDraftObstacle] = useState(null);
  const scale = DEFAULT_SCALE;
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const lastFrameRef = useRef(null);

  const selectedEntity = useMemo(() => entities.find(e => e.id === selectedId) || null, [entities, selectedId]);
  const trailer = useMemo(() => entities.find(e => e.type === "trailer") || null, [entities]);

  const addSlipbot = useCallback(() => {
    let created = null;
    setEntities(prev => {
      const usedSpots = new Set(prev.filter(e => e.type === "slipbot").map(e => e.parkingSpotId).filter(Boolean));
      const availableSpot = PARKING_SPOTS.find(spot => !usedSpots.has(spot.id));
      const fallbackCenter = { x: 40 + (prev.length % 5) * 24, y: 96 + (prev.length % 3) * 6 };
      created = createEntity("slipbot", {
        center: availableSpot ? { ...availableSpot.center } : fallbackCenter,
        rotation: availableSpot?.rotation ?? 0,
        parkingSpotId: availableSpot?.id || null,
        status: availableSpot ? "parked" : "idle"
      });
      return [...prev, created];
    });
    if (created) setSelectedId(created.id);
  }, []);

  const removeEntity = useCallback(id => {
    setEntities(prev => {
      const target = prev.find(entity => entity.id === id);
      if (!target || target.type === "trailer") return prev;
      return prev.filter(entity => entity.id !== id);
    });
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

  const isSegmentClear = useCallback(
    (from, to) =>
      !obstacles.some(obstacle =>
        lineIntersectsRect(from, to, { x: obstacle.x, y: obstacle.y, length: obstacle.length, width: obstacle.width }, OBSTACLE_PADDING)
      ),
    [obstacles]
  );

  const findParkingSpot = useCallback(id => PARKING_SPOTS.find(spot => spot.id === id) || null, []);

  const buildPath = useCallback(
    (start, goal) => {
      if (isSegmentClear(start, goal)) return [goal];

      const candidates = [];
      const detours = obstacles.map(obstacle => {
        const top = obstacle.y - OBSTACLE_PADDING;
        const bottom = obstacle.y + obstacle.width + OBSTACLE_PADDING;
        const left = obstacle.x - OBSTACLE_PADDING;
        const right = obstacle.x + obstacle.length + OBSTACLE_PADDING;
        return [
          [
            { x: start.x, y: top },
            { x: goal.x, y: top },
            goal
          ],
          [
            { x: start.x, y: bottom },
            { x: goal.x, y: bottom },
            goal
          ],
          [
            { x: left, y: start.y },
            { x: left, y: goal.y },
            goal
          ],
          [
            { x: right, y: start.y },
            { x: right, y: goal.y },
            goal
          ]
        ];
      });

      const flattened = detours.flat();
      const pathIsClear = path =>
        path.every((point, index) => {
          if (index === 0) return true;
          return isSegmentClear(path[index - 1], point);
        });

      flattened.forEach(path => {
        if (!pathIsClear([start, ...path])) return;
        const withStart = [start, ...path];
        const cost = withStart.reduce((sum, point, index) => {
          if (index === 0) return sum;
          return sum + distance(point, withStart[index - 1]);
        }, 0);
        candidates.push({ cost, path: path });
      });

      if (!candidates.length) return [goal];

      candidates.sort((a, b) => a.cost - b.cost);
      return candidates[0].path;
    },
    [isSegmentClear, obstacles]
  );

  const withHeadings = useCallback((start, points) => {
    const routed = [];
    let cursor = start;
    for (const point of points) {
      const heading = Math.atan2(point.y - cursor.y, point.x - cursor.x);
      routed.push({ ...point, heading });
      cursor = point;
    }
    return routed;
  }, []);

  const computeTrailerSlots = useCallback(
    trailerEntity => {
      if (!trailerEntity) return [];
      const spacing = ENTITY_TEMPLATES.slipbot.length;
      const startOffset = -trailerEntity.length / 2 + spacing / 2 + 1;
      return [0, 1, 2].map(index => ({
        index,
        point: worldPointFromLocal({ x: startOffset + spacing * index, y: 0 }, trailerEntity)
      }));
    },
    []
  );

  const commandEnter = useCallback(() => {
    if (!trailer) return;
    const slots = computeTrailerSlots(trailer);
    setEntities(prev => {
      const slipbots = prev.filter(entity => entity.type === "slipbot");
      const ordered = [...slipbots].sort((a, b) => (a.parkingSpotId || a.id).localeCompare(b.parkingSpotId || b.id));
      return prev.map(entity => {
        if (entity.type !== "slipbot") return entity;
        const slotIndex = ordered.findIndex(item => item.id === entity.id);
        const slot = slots[slotIndex] || slots[slots.length - 1];
        if (!slot) return entity;
        const path = buildPath(entity.center, slot.point);
        const route = withHeadings(entity.center, path);
        return {
          ...entity,
          route,
          status: "entering",
          trailerSlotIndex: slot.index,
          finalRotation: trailer.rotation,
          attachedTo: null,
          attachedOffset: null
        };
      });
    });
  }, [buildPath, computeTrailerSlots, trailer, withHeadings]);

  const commandExit = useCallback(() => {
    setEntities(prev => {
      return prev.map(entity => {
        if (entity.type !== "slipbot") return entity;
        const parking = findParkingSpot(entity.parkingSpotId);
        if (!parking) return entity;
        const startingPoint = entity.attachedTo && trailer && entity.attachedOffset
          ? worldPointFromLocal(entity.attachedOffset, trailer)
          : entity.center;
        const path = buildPath(startingPoint, parking.center);
        const route = withHeadings(startingPoint, path);
        return {
          ...entity,
          route,
          status: "exiting",
          attachedTo: null,
          attachedOffset: null,
          finalRotation: parking.rotation,
          trailerSlotIndex: null,
          center: startingPoint
        };
      });
    });
  }, [buildPath, findParkingSpot, trailer, withHeadings]);

  const handleEntityMouseDown = (event, entity) => {
    if (drawMode || entity.attachedTo) return;
    event.stopPropagation();
    setSelectedId(entity.id);
    const point = onMousePosition(event);
    if (!point) return;
    dragRef.current = {
      id: entity.id,
      type: entity.type,
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
      let translation = null;
      let draggedEntity = null;
      const updated = prev.map(entity => {
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
        translation = { x: clampedCenter.x - entity.center.x, y: clampedCenter.y - entity.center.y };
        draggedEntity = candidate;
        return candidate;
      });

      if (dragState.type === "trailer" && translation && (translation.x !== 0 || translation.y !== 0)) {
        const trailerEntity = draggedEntity || prev.find(e => e.id === dragState.id);
        return updated.map(entity => {
          if (entity.attachedTo !== dragState.id || !entity.attachedOffset || !trailerEntity) return entity;
          const nextCenter = worldPointFromLocal(entity.attachedOffset, trailerEntity);
          return { ...entity, center: nextCenter, rotation: trailerEntity.rotation };
        });
      }

      return updated;
    });
  };

  const handleMouseUp = () => {
    if (drawMode) {
      handleObstacleFinish();
    }
    dragRef.current = null;
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
          if (entity.attachedTo && trailer && entity.attachedOffset) {
            const center = worldPointFromLocal(entity.attachedOffset, trailer);
            return { ...entity, center, rotation: trailer.rotation, route: [] };
          }

          if (!entity.route.length) {
            if (entity.finalRotation != null) {
              return { ...entity, rotation: entity.finalRotation, finalRotation: null };
            }
            return entity;
          }

          const target = entity.route[0];
          const step = entity.speed * delta;
          const heading = target.heading ?? Math.atan2(target.y - entity.center.y, target.x - entity.center.x);
          const nextCenter = {
            x: entity.center.x + Math.cos(heading) * step,
            y: entity.center.y + Math.sin(heading) * step
          };
          const remaining = distance(entity.center, target);
          const newCenter = remaining <= step ? target : nextCenter;
          const desiredRotation = (heading * 180) / Math.PI;
          let candidate = {
            ...entity,
            center: clampToWorld(newCenter, entity.length, entity.width, desiredRotation),
            rotation: desiredRotation
          };
          if (entityCollides(candidate, prev, obstacles, entity.id)) {
            return { ...entity, route: [], status: "idle" };
          }
          const route = remaining <= WAYPOINT_THRESHOLD ? entity.route.slice(1) : entity.route;
          candidate = { ...candidate, route };

          if (!candidate.route.length) {
            if (candidate.finalRotation != null) {
              candidate = { ...candidate, rotation: candidate.finalRotation, finalRotation: null };
            }
            if (candidate.status === "entering" && trailer) {
              const offset = localPointFromWorld(candidate.center, trailer);
              candidate = {
                ...candidate,
                status: "inTrailer",
                attachedTo: trailer.id,
                attachedOffset: offset,
                rotation: trailer.rotation
              };
            } else if (candidate.status === "exiting") {
              candidate = { ...candidate, status: candidate.parkingSpotId ? "parked" : "idle" };
            }
          }

          return candidate;
        })
      );
    },
    [obstacles, trailer]
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

  useEffect(() => {
    if (!trailer) return;
    setEntities(prev =>
      prev.map(entity => {
        if (entity.attachedTo !== trailer.id || !entity.attachedOffset) return entity;
        const center = worldPointFromLocal(entity.attachedOffset, trailer);
        return { ...entity, center, rotation: trailer.rotation };
      })
    );
  }, [trailer]);

  const renderEntities = entities.map(entity => {
    const Renderer = ENTITY_RENDERERS[entity.type];
    if (!Renderer) return null;
    return (
      <g
        key={entity.id}
        className="draggable"
        onMouseDown={event => handleEntityMouseDown(event, entity)}
        onDoubleClick={entity.type === "slipbot" ? () => removeEntity(entity.id) : undefined}
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
          <button onClick={addSlipbot}>Add SlipBot</button>
          <button className={drawMode ? "active" : ""} onClick={() => setDrawMode(v => !v)}>
            {drawMode ? "Drawing…" : "Draw"}
          </button>
          <button onClick={commandEnter}>Enter</button>
          <button onClick={commandExit}>Exit</button>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-inner">
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
          >
            <defs>
              <pattern id="grid" width={GRID_GAP} height={GRID_GAP} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_GAP} 0 L 0 0 0 ${GRID_GAP}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="url(#grid)" />

            {PARKING_SPOTS.map(spot => (
              <ParkingSpotShadow key={spot.id} spot={spot} />
            ))}
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
              <p className="hint">Use Enter to load the trailer and Exit to return to parking.</p>
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
