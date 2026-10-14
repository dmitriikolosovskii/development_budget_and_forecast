import { create } from 'zustand';

export type ToastTone = 'info' | 'ok' | 'risk';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (text: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Client UI state for toasts; callable outside React (e.g. from the autosave queue). */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (text, tone = 'info') => set((s) => ({ toasts: [...s.toasts, { id: nextId++, tone, text }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function showToast(text: string, tone: ToastTone = 'info'): void {
  useToastStore.getState().push(text, tone);
}
