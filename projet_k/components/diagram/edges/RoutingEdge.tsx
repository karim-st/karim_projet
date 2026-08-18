import { useEffect, useMemo, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from "reactflow";
import { useClockStore } from "../../../store/clockStore";
import { clockEventBus } from "../../../features/eventBus/clockEventBus";

type RoutingPoint = {
  kind: "linear";
  x: number;
  y: number;
  pointIndex: number;
};

type RoutingEdgeData = {
  routingPoints?: RoutingPoint[];
  labelPosition?: { x: number; y: number };
  isHighlighted?: boolean;
  hasError?: boolean;
  darkMode?: boolean;
  readOnly?: boolean;
  showControlPoints?: boolean;
  fanOut?: {
    branchOffset: number;
    showJunction: boolean;
  };
};

type HelperLines = {
  x?: number;
  y?: number;
};

type BridgeCrossing = {
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
};

const SNAP_DISTANCE = 10;
const BRIDGE_RADIUS = 8;

function buildOrthogonalPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  routingPoints?: RoutingPoint[]
): Array<{ x: number; y: number }> {
  const rawPoints = [
    { x: sourceX, y: sourceY },
    ...(routingPoints ?? [])
      .slice()
      .sort((a, b) => a.pointIndex - b.pointIndex)
      .map((p) => ({ x: p.x, y: p.y })),
    { x: targetX, y: targetY }
  ];

  const points = rawPoints.filter((point, index) => {
    if (index === 0) return true;
    const previous = rawPoints[index - 1];
    return point.x !== previous.x || point.y !== previous.y;
  });

  if (points.length < 2) return [];

  return points.flatMap((point, index) => {
    if (index === 0) return [point];
    const previous = points[index - 1];
    return previous.x === point.x || previous.y === point.y
      ? [point]
      : [{ x: previous.x, y: point.y }, point];
  });
}

function buildOrthogonalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  routingPoints?: RoutingPoint[]
): string {
  const orthogonalPoints = buildOrthogonalPoints(sourceX, sourceY, targetX, targetY, routingPoints);
  if (orthogonalPoints.length < 2) return "";

  return orthogonalPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function lineIntersection(
  firstStart: DOMPoint,
  firstEnd: DOMPoint,
  secondStart: DOMPoint,
  secondEnd: DOMPoint
): { x: number; y: number } | null {
  const firstVector = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const secondVector = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  const divisor = firstVector.x * secondVector.y - firstVector.y * secondVector.x;
  if (Math.abs(divisor) < 0.01) return null;

  const delta = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
  const firstScale = (delta.x * secondVector.y - delta.y * secondVector.x) / divisor;
  const secondScale = (delta.x * firstVector.y - delta.y * firstVector.x) / divisor;
  if (firstScale <= 0.02 || firstScale >= 0.98 || secondScale <= 0.02 || secondScale >= 0.98) return null;

  return {
    x: firstStart.x + firstScale * firstVector.x,
    y: firstStart.y + firstScale * firstVector.y
  };
}

function pathBridgeCrossings(currentPath: SVGPathElement, otherPath: SVGPathElement): BridgeCrossing[] {
  const samplePath = (path: SVGPathElement) => {
    const length = path.getTotalLength();
    const samples: DOMPoint[] = [];
    for (let position = 0; position <= length; position += 5) {
      samples.push(path.getPointAtLength(position));
    }
    if (samples.length === 0 || samples[samples.length - 1].x !== path.getPointAtLength(length).x || samples[samples.length - 1].y !== path.getPointAtLength(length).y) {
      samples.push(path.getPointAtLength(length));
    }
    return samples;
  };

  const currentSamples = samplePath(currentPath);
  const otherSamples = samplePath(otherPath);
  const crossings: BridgeCrossing[] = [];

  for (let currentIndex = 1; currentIndex < currentSamples.length; currentIndex += 1) {
    const currentStart = currentSamples[currentIndex - 1];
    const currentEnd = currentSamples[currentIndex];
    const currentHorizontal = Math.abs(currentEnd.x - currentStart.x) >= Math.abs(currentEnd.y - currentStart.y);
    for (let otherIndex = 1; otherIndex < otherSamples.length; otherIndex += 1) {
      const intersection = lineIntersection(
        currentStart,
        currentEnd,
        otherSamples[otherIndex - 1],
        otherSamples[otherIndex]
      );
      if (!intersection || crossings.some((point) => Math.hypot(point.x - intersection.x, point.y - intersection.y) < 7)) continue;
      crossings.push({
        ...intersection,
        orientation: currentHorizontal ? "horizontal" : "vertical"
      });
    }
  }

  return crossings;
}

export function RoutingEdge({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  data,
  label,
  selected
}: EdgeProps<RoutingEdgeData>) {
  const updateEdges = useClockStore((state) => state.updateEdges);
  const transitions = useClockStore((state) => state.project.tree.transitions);
  const { screenToFlowPosition } = useReactFlow();
  const [draftPoints, setDraftPoints] = useState<RoutingPoint[] | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [helperLines, setHelperLines] = useState<HelperLines>({});
  const [bridgeCrossings, setBridgeCrossings] = useState<BridgeCrossing[]>([]);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedControlPoint, setSelectedControlPoint] = useState<number | null>(null);
  const routingPoints = draftPoints ?? data?.routingPoints ?? [];

  useEffect(() => {
    if (draggedPointIndex === null) setDraftPoints(null);
  }, [data?.routingPoints, draggedPointIndex]);

  const snapPoint = (point: { x: number; y: number }, pointIndex: number) => {
    const anchors = [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
      ...routingPoints.filter((candidate) => candidate.pointIndex !== pointIndex)
    ];
    let x = point.x;
    let y = point.y;
    let guideX: number | undefined;
    let guideY: number | undefined;

    for (const anchor of anchors) {
      if (Math.abs(point.x - anchor.x) <= SNAP_DISTANCE) {
        x = anchor.x;
        guideX = anchor.x;
      }
      if (Math.abs(point.y - anchor.y) <= SNAP_DISTANCE) {
        y = anchor.y;
        guideY = anchor.y;
      }
    }

    return { point: { x, y }, helperLines: { x: guideX, y: guideY } };
  };

  useEffect(() => {
    if (draggedPointIndex === null) return;

    const handlePointerMove = (event: PointerEvent) => {
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const snapped = snapPoint(flowPosition, draggedPointIndex);
      setHelperLines(snapped.helperLines);
      setDraftPoints((currentPoints) => (currentPoints ?? routingPoints).map((point) =>
        point.pointIndex === draggedPointIndex
          ? { ...point, x: snapped.point.x, y: snapped.point.y }
          : point
      ));
    };
    const handlePointerUp = () => {
      setDraftPoints((currentPoints) => {
        if (currentPoints) {
          const movedPoint = currentPoints.find((point) => point.pointIndex === draggedPointIndex);
          const delta = movedPoint && dragOrigin
            ? { x: movedPoint.x - dragOrigin.x, y: movedPoint.y - dragOrigin.y }
            : null;
          updateEdges(transitions.map((transition) =>
            transition.id === id
              ? { ...transition, transitionRoutingPoint: currentPoints }
              : delta && dragOrigin
                ? {
                    ...transition,
                    transitionRoutingPoint: transition.transitionRoutingPoint?.map((point) =>
                      Math.abs(point.x - dragOrigin.x) < 0.5 && Math.abs(point.y - dragOrigin.y) < 0.5
                        ? { ...point, x: point.x + delta.x, y: point.y + delta.y }
                        : point
                    )
                  }
              : transition
          ));
        }
        return null;
      });
      setDraggedPointIndex(null);
      setDragOrigin(null);
      setHelperLines({});
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragOrigin, draggedPointIndex, id, routingPoints, screenToFlowPosition, transitions, updateEdges]);

  const editablePoints = useMemo(() => routingPoints.slice().sort((a, b) => a.pointIndex - b.pointIndex), [routingPoints]);
  const startPointDrag = (event: React.PointerEvent<SVGCircleElement>, pointIndex: number) => {
    if (data?.readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const point = routingPoints.find((candidate) => candidate.pointIndex === pointIndex);
    if (!point) return;
    setDraftPoints(routingPoints);
    setDragOrigin({ x: point.x, y: point.y });
    setDraggedPointIndex(pointIndex);
    setSelectedControlPoint(pointIndex);
  };

  const startJunctionDrag = (event: React.PointerEvent<SVGCircleElement>, point: { x: number; y: number }) => {
    if (data?.readOnly || !data?.showControlPoints) return;
    event.preventDefault();
    event.stopPropagation();
    const existingPoint = routingPoints.find((candidate) =>
      Math.abs(candidate.x - point.x) < 0.5 && Math.abs(candidate.y - point.y) < 0.5
    );
    const pointIndex = existingPoint?.pointIndex ?? (
      routingPoints.length === 0
        ? 0
        : Math.max(...routingPoints.map((candidate) => candidate.pointIndex)) + 1
    );
    const nextPoints = existingPoint
      ? routingPoints
      : [...routingPoints, { kind: "linear" as const, x: point.x, y: point.y, pointIndex }];

    setDraftPoints(nextPoints);
    setDragOrigin({ x: point.x, y: point.y });
    setDraggedPointIndex(pointIndex);
    setSelectedControlPoint(pointIndex);
  };

  const startSegmentDrag = (
    event: React.PointerEvent<SVGCircleElement>,
    segmentStart: { x: number; y: number },
    segmentEnd: { x: number; y: number }
  ) => {
    if (data?.readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const pointIndex = routingPoints.length === 0
      ? 0
      : Math.max(...routingPoints.map((point) => point.pointIndex)) + 1;
    const point = {
      kind: "linear" as const,
      x: (segmentStart.x + segmentEnd.x) / 2,
      y: (segmentStart.y + segmentEnd.y) / 2,
      pointIndex
    };
    setDraftPoints([...routingPoints, point]);
    setDragOrigin({ x: point.x, y: point.y });
    setDraggedPointIndex(pointIndex);
    setSelectedControlPoint(pointIndex);
  };

  const removeRoutingPoint = (event: React.MouseEvent<SVGCircleElement>, pointIndex: number) => {
    if (data?.readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const nextPoints = routingPoints.filter((point) => point.pointIndex !== pointIndex);
    updateEdges(transitions.map((transition) =>
      transition.id === id ? { ...transition, transitionRoutingPoint: nextPoints } : transition
    ));
    setSelectedControlPoint(null);
  };

  const fanOutJunction = data?.fanOut
    ? { x: sourceX + data.fanOut.branchOffset, y: sourceY }
    : undefined;
  const pathRoutingPoints = fanOutJunction
    ? [
        { kind: "linear" as const, x: fanOutJunction.x, y: fanOutJunction.y, pointIndex: -1 },
        ...routingPoints
      ]
    : routingPoints;
  const path = buildOrthogonalPath(sourceX, sourceY, targetX, targetY, pathRoutingPoints);
  const orthogonalPoints = buildOrthogonalPoints(
    sourceX,
    sourceY,
    targetX,
    targetY,
    pathRoutingPoints
  );
  const junctionPoints = orthogonalPoints
    .filter((point, index, points) => {
      if (index === 0 || index === points.length - 1) return false;
      const previous = points[index - 1];
      const next = points[index + 1];
      return (previous.x === point.x && point.y === next.y) || (previous.y === point.y && point.x === next.x);
    })
    .filter((point, index, points) =>
      points.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y) === index
    );
  const isFixedFanOutJunction = (point: { x: number; y: number }) => Boolean(
    fanOutJunction &&
    Math.abs(point.x - fanOutJunction.x) < 0.5 &&
    Math.abs(point.y - fanOutJunction.y) < 0.5
  );

  const isPrimaryForPort = useMemo(() => {
    if (!fanOutJunction) return true;
    const siblings = transitions.filter(
      (transition) => transition.source === source && transition.sourceHandle === sourceHandleId
    );
    return siblings.length === 0 || siblings[0]?.id === id;
  }, [transitions, source, sourceHandleId, id, fanOutJunction]);

  const segmentHandles = orthogonalPoints.slice(1).map((end, index) => {
    const start = orthogonalPoints[index];
    return {
      start,
      end,
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2
    };
  }).filter((segment) => Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) > 16);
  const labelX = sourceX + (targetX - sourceX) * 0.5;
  const labelY = targetY;
  const edgeStyle = {
    stroke: "#7b8798",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...style
  };
  const lineColor = typeof edgeStyle.stroke === "string" ? edgeStyle.stroke : "#7b8798";
  const junctionFill = selected ? "#087fdb" : data?.hasError ? "#e5484d" : "#7b8798";
  const junctionStroke = selected ? "#075dc2" : "#3a4452";
  const isEmphasized = selected || data?.isHighlighted === true;
  const showControls = !data?.readOnly && data?.showControlPoints === true && (selected || isHovered || draggedPointIndex !== null);
  const canvasColor = data?.darkMode ? "#1b222c" : "#f5f6f8";
  const selectEdge = () => clockEventBus.emit("clock-edge-select", id);

  useEffect(() => {
    const currentPath = document.getElementById(id) as SVGPathElement | null;
    const svg = currentPath?.ownerSVGElement;
    if (!currentPath || !svg) return;

    const recompute = () => {
      const crossings = Array.from(svg.querySelectorAll<SVGPathElement>(".react-flow__edge-path"))
        .filter((pathElement) =>
          pathElement.id &&
          pathElement.id !== id &&
          !pathElement.id.endsWith("-outline") &&
          Boolean(pathElement.compareDocumentPosition(currentPath) & Node.DOCUMENT_POSITION_FOLLOWING)
        )
        .flatMap((pathElement) => pathBridgeCrossings(currentPath, pathElement));
      setBridgeCrossings((previous) => JSON.stringify(previous) === JSON.stringify(crossings) ? previous : crossings);
    };

    recompute();
    const observer = new MutationObserver(recompute);
    observer.observe(svg, {
      attributes: true,
      attributeFilter: ["d"],
      subtree: true
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, path]);

  return (
    <g
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        selectEdge();
      }}
    >
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        pointerEvents="stroke"
        onClick={(event) => {
          event.stopPropagation();
          selectEdge();
        }}
      />
      {!isEmphasized && (
        <BaseEdge
          id={`${id}-outline`}
          path={path}
          style={{ stroke: canvasColor, strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" }}
        />
      )}
      <BaseEdge id={id} path={path} style={edgeStyle} markerEnd={markerEnd} />
      {!isEmphasized && bridgeCrossings.map((crossing, index) => (
        <g key={`${crossing.x}-${crossing.y}-${index}`} pointerEvents="none">
          <circle cx={crossing.x} cy={crossing.y} r={BRIDGE_RADIUS} fill={canvasColor} />
          {crossing.orientation === "horizontal" ? (
            <path d={`M ${crossing.x - BRIDGE_RADIUS} ${crossing.y} L ${crossing.x - 4} ${crossing.y} Q ${crossing.x} ${crossing.y - 6} ${crossing.x + 4} ${crossing.y} L ${crossing.x + BRIDGE_RADIUS} ${crossing.y}`} fill="none" stroke={lineColor} strokeWidth={edgeStyle.strokeWidth} strokeLinecap="round" />
          ) : (
            <path d={`M ${crossing.x} ${crossing.y - BRIDGE_RADIUS} L ${crossing.x} ${crossing.y - 4} Q ${crossing.x + 6} ${crossing.y} ${crossing.x} ${crossing.y + 4} L ${crossing.x} ${crossing.y + BRIDGE_RADIUS}`} fill="none" stroke={lineColor} strokeWidth={edgeStyle.strokeWidth} strokeLinecap="round" />
          )}
        </g>
      ))}
      {!data?.readOnly && junctionPoints.map((point, index) => {
        const isPortPoint = isFixedFanOutJunction(point);
        if (isPortPoint && !isPrimaryForPort) return null;
        const canDrag = !data?.readOnly && data?.showControlPoints && !isPortPoint;
        return (
          <g key={`${point.x}-${point.y}-${index}`}>
            {isPortPoint && (
              <>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={5}
                  fill={selected ? "#087fdb" : "#3b82f6"}
                  opacity={0.2}
                  pointerEvents="none"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill="none"
                  stroke={selected ? "#087fdb" : "#3b82f6"}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  pointerEvents="none"
                />
              </>
            )}
            <circle
              cx={point.x}
              cy={point.y}
              r={isPortPoint ? 3.5 : selected ? 2 : 3}
              fill={isPortPoint ? (selected ? "#087fdb" : "#3b82f6") : junctionFill}
              stroke={isPortPoint ? (selected ? "#075dc2" : "#1e40af") : junctionStroke}
              strokeWidth={1.5}
              className={canDrag ? "cursor-grab" : undefined}
              pointerEvents={canDrag ? "all" : "none"}
              onPointerDown={canDrag ? (event) => startJunctionDrag(event, point) : undefined}
            />
          </g>
        );
      })}
      {showControls && (
        <>
          {helperLines.x !== undefined && (
            <line x1={helperLines.x} x2={helperLines.x} y1={Math.min(sourceY, targetY) - 120} y2={Math.max(sourceY, targetY) + 120} stroke="#087fdb" strokeWidth={1} strokeDasharray="4 4" />
          )}
          {helperLines.y !== undefined && (
            <line x1={Math.min(sourceX, targetX) - 120} x2={Math.max(sourceX, targetX) + 120} y1={helperLines.y} y2={helperLines.y} stroke="#087fdb" strokeWidth={1} strokeDasharray="4 4" />
          )}
          {editablePoints.map((point) => (
            <circle
              key={point.pointIndex}
              cx={point.x}
              cy={point.y}
              r={4}
              fill={selectedControlPoint === point.pointIndex ? "#fbbf24" : "#087fdb"}
              stroke="#075dc2"
              strokeWidth={1.5}
              className="cursor-grab"
              onPointerDown={(event) => startPointDrag(event, point.pointIndex)}
              onDoubleClick={(event) => removeRoutingPoint(event, point.pointIndex)}
              onContextMenu={(event) => removeRoutingPoint(event, point.pointIndex)}
            />
          ))}
          {selected && segmentHandles.map((segment, index) => (
            <circle
              key={`${segment.start.x}-${segment.start.y}-${segment.end.x}-${segment.end.y}-${index}`}
              cx={segment.x}
              cy={segment.y}
              r={3.25}
              fill="#ffffff"
              stroke="#087fdb"
              strokeWidth={1.5}
              className="cursor-crosshair"
              onPointerDown={(event) => startSegmentDrag(event, segment.start, segment.end)}
            />
          ))}
        </>
      )}
      {label != null && label !== "" && (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan absolute px-1 text-[8px] ${
              data?.darkMode ? "bg-[#1b222c] text-white" : "bg-[#f5f6f8] text-[#536273]"
            }`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}