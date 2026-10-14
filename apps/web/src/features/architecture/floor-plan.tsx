import { useMemo, useRef, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import type { Room } from '@default-project/types';
import { Badge } from '../../ui/badge';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { DRAW, ROOM_FILL } from './drawing-colors';
import { NorthArrow } from './north-arrow';
import { FLOORS, findRoomIssues, formatAreaM2, innerFrame, issueMessages, livingAreaCm2, roomAreaCm2, WALL_CM } from './plan-geometry';
import { RoomModal } from './room-modal';
import { usePlan } from './use-plan';
import { useCreateRoom } from './use-plan-edits';

const PAD = 90;

/** Saves the drawing as a standalone .svg file. */
function downloadSvg(svg: SVGSVGElement, fileName: string): void {
  const source = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function ScaleBar({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden>
      <rect x={x} y={y} width={100} height={10} fill={DRAW.ink} />
      <rect x={x + 100} y={y} width={100} height={10} fill={DRAW.surface} stroke={DRAW.ink} strokeWidth={2} />
      <text x={x} y={y + 34} fontSize={22} fill={DRAW.muted}>0</text>
      <text x={x + 90} y={y + 34} fontSize={22} fill={DRAW.muted}>1</text>
      <text x={x + 180} y={y + 34} fontSize={22} fill={DRAW.muted}>2 m</text>
    </g>
  );
}

export interface FloorPlanProps {
  projectId: string;
}

/** SVG floor plan of one storey (GF/UF switch); rooms are drawn from rectangles in cm (1 SVG unit = 1 cm). */
export function FloorPlan({ projectId }: FloorPlanProps) {
  const plan = usePlan(projectId).data;
  const createRoom = useCreateRoom(projectId);
  const svgRef = useRef<SVGSVGElement>(null);
  const [floor, setFloor] = useState<number>(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const frame = useMemo(() => (plan ? innerFrame(plan) : { widthCm: 0, depthCm: 0 }), [plan]);
  const issues = useMemo(() => findRoomIssues(plan?.rooms ?? [], frame), [plan?.rooms, frame]);
  if (!plan) return null;

  const floors = FLOORS.filter((f) => f.floor < Math.max(plan.storeys, 1));
  const rooms = plan.rooms.filter((r) => r.floor === floor);
  const messages = issueMessages(rooms, issues);
  const label = FLOORS.find((f) => f.floor === floor)?.label ?? `Floor ${floor}`;
  const width = frame.widthCm + 2 * WALL_CM + 2 * PAD;
  const height = frame.depthCm + 2 * WALL_CM + 2 * PAD + 60;

  const addRoom = () => {
    const prefix = floor === 0 ? 'GF' : 'UF';
    const codes = new Set(plan.rooms.map((r) => r.code));
    let n = 1;
    while (codes.has(`${prefix}-R${n}`)) n += 1;
    void createRoom({ code: `${prefix}-R${n}`, floor, name: 'New room', kind: 'storage', xCm: 0, yCm: 0, wCm: 200, hCm: 200, sortOrder: rooms.length });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Storey" className="inline-flex rounded-xl bg-subtle p-1">
          {floors.map((f) => (
            <button
              key={f.floor}
              type="button"
              role="tab"
              aria-selected={floor === f.floor}
              onClick={() => setFloor(f.floor)}
              className={cx(
                'rounded-lg px-3 py-1 text-sm',
                floor === f.floor ? 'bg-surface font-medium text-ink shadow-[var(--shadow-soft)]' : 'text-muted hover:text-ink',
                SOFT,
                FOCUS,
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">
            {label}: <span className="font-medium text-ink">{formatAreaM2(livingAreaCm2(rooms))}</span>
          </span>
          <button type="button" onClick={addRoom} className={cx('inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 hover:bg-subtle', SOFT, FOCUS)}>
            <Plus aria-hidden className="h-4 w-4" /> Add room
          </button>
          <button
            type="button"
            onClick={() => svgRef.current && downloadSvg(svgRef.current, `floor-plan-${floor === 0 ? 'gf' : 'uf'}.svg`)}
            className={cx('inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 hover:bg-subtle', SOFT, FOCUS)}
          >
            <Download aria-hidden className="h-4 w-4" /> Download SVG
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <div role="alert" className="rounded-xl border border-risk-600/30 bg-risk-50 px-3 py-2 text-sm text-risk-600">
          <p className="font-medium">Check the layout (saved anyway):</p>
          <ul className="list-disc pl-5">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${-PAD - WALL_CM} ${-PAD - WALL_CM} ${width} ${height}`}
        role="img"
        aria-label={`${label} plan`}
        className="h-auto w-full max-w-3xl rounded-xl border border-line bg-surface"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      >
        <rect
          x={-WALL_CM}
          y={-WALL_CM}
          width={frame.widthCm + 2 * WALL_CM}
          height={frame.depthCm + 2 * WALL_CM}
          fill={DRAW.wall}
        />
        <rect x={0} y={0} width={frame.widthCm} height={frame.depthCm} fill={DRAW.surface} />
        {rooms.map((r) => (
          <RoomShape
            key={r.id}
            room={r}
            invalid={!!issues[r.id]}
            hovered={hovered === r.id}
            onHover={setHovered}
            onOpen={setEditing}
          />
        ))}
        <NorthArrow x={frame.widthCm + 30} y={-WALL_CM - 10} />
        <ScaleBar x={0} y={frame.depthCm + WALL_CM + 30} />
      </svg>
      <p className="text-xs text-muted">
        Inner frame {frame.widthCm} × {frame.depthCm} cm (footprint minus {WALL_CM} cm walls). Click a room to edit it.
      </p>

      {editing && <RoomModal projectId={projectId} roomId={editing} onClose={() => setEditing(null)} />}
      {plan.rooms.some((r) => r.floor !== floor && issues[r.id]) && (
        <Badge tone="warn">Another storey has layout warnings</Badge>
      )}
    </div>
  );
}

interface RoomShapeProps {
  room: Room;
  invalid: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}

function RoomShape({ room, invalid, hovered, onHover, onOpen }: RoomShapeProps) {
  const label = `${room.name} ${formatAreaM2(roomAreaCm2(room), 1)}`;
  const cx_ = room.xCm + room.wCm / 2;
  const cy = room.yCm + room.hCm / 2;
  const fontSize = Math.max(Math.min(room.wCm / 9, 24), 12);
  return (
    <g
      data-testid={`room-${room.code}`}
      data-invalid={invalid || undefined}
      role="button"
      tabIndex={0}
      aria-label={label}
      onMouseEnter={() => onHover(room.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onOpen(room.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(room.id);
        }
      }}
      className="cursor-pointer outline-none"
    >
      <rect
        x={room.xCm}
        y={room.yCm}
        width={room.wCm}
        height={room.hCm}
        fill={hovered ? '#dbe7ff' : (ROOM_FILL[room.kind] ?? DRAW.surface)}
        stroke={invalid ? DRAW.risk : hovered ? DRAW.brand : DRAW.muted}
        strokeWidth={invalid ? 8 : hovered ? 5 : 2}
        fillOpacity={invalid ? 0.85 : 1}
      />
      <text x={cx_} y={cy - fontSize * 0.2} fontSize={fontSize} textAnchor="middle" fill={DRAW.ink} fontWeight={600}>
        {room.name}
      </text>
      <text x={cx_} y={cy + fontSize * 1.1} fontSize={fontSize * 0.85} textAnchor="middle" fill={DRAW.muted}>
        {formatAreaM2(roomAreaCm2(room), 1)}
      </text>
    </g>
  );
}
