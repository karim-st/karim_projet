import { Position, type ConnectionLineComponentProps } from "reactflow";

const INITIAL_SEGMENT_LENGTH = 96;

function buildPreviewPath({ fromX, fromY, toX, toY, fromPosition }: ConnectionLineComponentProps): string {
  const points = [{ x: fromX, y: fromY }];

  if (fromPosition === Position.Left || fromPosition === Position.Right) {
    const direction = fromPosition === Position.Right ? 1 : -1;
    const bendX = fromX + direction * INITIAL_SEGMENT_LENGTH;
    points.push({ x: bendX, y: fromY }, { x: bendX, y: toY });
  } else {
    const direction = fromPosition === Position.Bottom ? 1 : -1;
    const bendY = fromY + direction * INITIAL_SEGMENT_LENGTH;
    points.push({ x: fromX, y: bendY }, { x: toX, y: bendY });
  }

  points.push({ x: toX, y: toY });
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function ConnectionPreview(props: ConnectionLineComponentProps) {
  const path = buildPreviewPath(props);

  return (
    <g>
      <defs>
        <marker
          id="clock-connection-preview-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#087fdb" />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="#087fdb"
        strokeWidth={2.5}
        strokeLinejoin="round"
        markerEnd="url(#clock-connection-preview-arrow)"
        style={props.connectionLineStyle}
      />
    </g>
  );
}