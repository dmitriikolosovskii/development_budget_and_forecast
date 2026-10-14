import { act, fireEvent, screen, within } from '@testing-library/react';
import { autosaveQueue, AUTOSAVE_DELAY_MS } from '../../lib/autosave-queue';
import { fakeResponse, mockApi } from '../../testing/render';
import { makeRooms } from './architecture-fixtures';
import { PID, renderWithPlan } from './architecture-test-utils';
import { FloorPlan } from './floor-plan';

const rooms = () => screen.getAllByTestId(/^room-/);

function editRoomWidth(code: string, width: string) {
  fireEvent.click(screen.getByTestId(`room-${code}`));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Width (cm)'), { target: { value: width } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
}

describe('FloorPlan', () => {
  beforeEach(() => autosaveQueue.__reset());

  it('should draw 6 ground-floor rooms and 8 upper-floor rooms with their labels [AC-08.5]', () => {
    renderWithPlan(<FloorPlan projectId={PID} />);

    expect(rooms()).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Living + dining 33.0 m²' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bathroom 10.8 m²' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Upper floor' }));

    expect(rooms()).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Bathroom 10.8 m²' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Living + dining 33.0 m²' })).toBeNull();
  });

  it('should keep a room edit when switching GF → UF → GF [AC-08.5]', async () => {
    mockApi({ 'PATCH /api/projects/project-1/plan/rooms/GF-KIT': () => fakeResponse({ ...makeRooms()[1], wCm: 300 }) });
    renderWithPlan(<FloorPlan projectId={PID} />);

    editRoomWidth('GF-KIT', '300');
    expect(await screen.findByRole('button', { name: 'Kitchen 8.4 m²' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Upper floor' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ground floor' }));

    expect(screen.getByRole('button', { name: 'Kitchen 8.4 m²' })).toBeTruthy();
  });

  it('should outline overlapping rooms in red with a message and still save the room [AC-08.3]', async () => {
    vi.useFakeTimers();
    const fetchMock = mockApi({
      'PATCH /api/projects/project-1/plan/rooms/GF-KIT': () => fakeResponse({ ...makeRooms()[1], xCm: 500 }),
    });
    renderWithPlan(<FloorPlan projectId={PID} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('room-GF-KIT').getAttribute('data-invalid')).toBeNull();

    fireEvent.click(screen.getByTestId('room-GF-KIT'));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('X from the left wall (cm)'), { target: { value: '500' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await act(() => vi.advanceTimersByTimeAsync(50));

    expect(screen.getByRole('alert').textContent).toContain('Living + dining overlaps Kitchen');
    expect(screen.getByTestId('room-GF-KIT').getAttribute('data-invalid')).toBe('true');
    expect(screen.getByTestId('room-GF-LIV').getAttribute('data-invalid')).toBe('true');
    expect(screen.getByTestId('room-GF-STU').getAttribute('data-invalid')).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0][1]?.body as string)).toMatchObject({ xCm: 500 });
    vi.useRealTimers();
  });

  it('should reject a zero width in the room form without saving', () => {
    const fetchMock = mockApi({});
    renderWithPlan(<FloorPlan projectId={PID} />);

    editRoomWidth('GF-KIT', '0');

    return screen.findByText('At least 1 cm').then(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('should download the drawing as an SVG file', () => {
    const createUrl = vi.fn(() => 'blob:plan');
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderWithPlan(<FloorPlan projectId={PID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Download SVG' }));

    expect(createUrl).toHaveBeenCalledTimes(1);
    const blob = (createUrl.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('image/svg+xml');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
