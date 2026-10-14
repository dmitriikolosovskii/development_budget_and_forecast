import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ROOM_KINDS, roomKindSchema } from '@default-project/types';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { Modal } from '../../ui/modal';
import { formatAreaM2 } from './plan-geometry';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import type { ProjectCache } from '../project/project-cache';
import { useCallback } from 'react';
import { findRoom } from './plan-cache';
import { useDeleteRoom, useEditRoom } from './use-plan-edits';

const sizeCm = z.number({ error: 'Enter whole centimetres' }).int('Enter whole centimetres').min(1, 'At least 1 cm').max(100_000);
const posCm = z.number({ error: 'Enter whole centimetres' }).int('Enter whole centimetres').min(0, 'Not below 0').max(100_000);

/** Same limits as the API DTO; overlaps are not checked here (they are a warning on the plan). */
const roomFormSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  kind: roomKindSchema,
  xCm: posCm,
  yCm: posCm,
  wCm: sizeCm,
  hCm: sizeCm,
});
type RoomForm = z.infer<typeof roomFormSchema>;

const FIELDS: Array<{ key: 'xCm' | 'yCm' | 'wCm' | 'hCm'; label: string }> = [
  { key: 'wCm', label: 'Width (cm)' },
  { key: 'hCm', label: 'Depth (cm)' },
  { key: 'xCm', label: 'X from the left wall (cm)' },
  { key: 'yCm', label: 'Y from the top wall (cm)' },
];

const INPUT = cx('w-full rounded-lg border border-line bg-surface px-2 py-1.5', SOFT, FOCUS);

export interface RoomModalProps {
  projectId: string;
  roomId: string;
  onClose: () => void;
}

export function RoomModal({ projectId, roomId, onClose }: RoomModalProps) {
  const select = useCallback((c: ProjectCache) => findRoom(c, roomId), [roomId]);
  const room = useProjectSnapshot(projectId, select).data;
  const editRoom = useEditRoom(projectId);
  const deleteRoom = useDeleteRoom(projectId);
  const { register, handleSubmit, watch, formState } = useForm<RoomForm>({
    resolver: zodResolver(roomFormSchema),
    values: room && { name: room.name, kind: room.kind as RoomForm['kind'], xCm: room.xCm, yCm: room.yCm, wCm: room.wCm, hCm: room.hCm },
  });
  if (!room) return null;
  const w = watch('wCm');
  const h = watch('hCm');

  const save = handleSubmit((values) => {
    editRoom(roomId, values);
    onClose();
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit room ${room.code}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              void deleteRoom(roomId);
              onClose();
            }}
            className={cx('rounded-lg px-3 py-1.5 text-sm text-risk-600 hover:bg-risk-50', SOFT, FOCUS)}
          >
            Delete room
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={cx('rounded-lg px-3 py-1.5 text-sm hover:bg-subtle', SOFT, FOCUS)}>
              Cancel
            </button>
            <button
              type="submit"
              form="room-form"
              className={cx('rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600', SOFT, FOCUS)}
            >
              Save
            </button>
          </div>
        </div>
      }
    >
      <form id="room-form" onSubmit={save} className="grid grid-cols-2 gap-3 text-sm" noValidate>
        <label className="col-span-2 space-y-1">
          <span className="text-muted">Name</span>
          <input className={INPUT} {...register('name')} />
          {formState.errors.name && <span role="alert" className="block text-xs text-risk-600">{formState.errors.name.message}</span>}
        </label>
        <label className="col-span-2 space-y-1">
          <span className="text-muted">Kind</span>
          <select className={INPUT} {...register('kind')}>
            {ROOM_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        {FIELDS.map((f) => (
          <label key={f.key} className="space-y-1">
            <span className="text-muted">{f.label}</span>
            <input type="number" inputMode="numeric" className={INPUT} {...register(f.key, { valueAsNumber: true })} />
            {formState.errors[f.key] && (
              <span role="alert" className="block text-xs text-risk-600">
                {formState.errors[f.key]?.message}
              </span>
            )}
          </label>
        ))}
        <p className="col-span-2 text-muted">
          Area: <span className="font-medium text-ink">{Number.isInteger(w) && Number.isInteger(h) ? formatAreaM2(w * h) : '—'}</span>
        </p>
      </form>
    </Modal>
  );
}
