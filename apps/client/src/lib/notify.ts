// Feedback that works on every platform — and always in the app's own voice.
//   · informational messages → toast() — non-blocking, top of screen
//   · questions/acknowledgements → confirmDialog()/ackDialog() — the themed
//     in-app DialogHost (system popups looked foreign; window.confirm can't
//     be styled at all). Signatures are unchanged: fire-and-forget with a
//     callback, so call sites never touch the store themselves.
import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (text: string, kind: ToastKind) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (text, kind) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
    // Toasts are glanceable confirmations, not persistent state: they clear
    // themselves (and on tap, via dismiss).
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Brief on-screen confirmation ("Location saved", errors, …). */
export function toast(text: string, kind: ToastKind = "success") {
  useToastStore.getState().push(text, kind);
}

/** One queued question, rendered by <DialogHost /> in the root layout. */
interface DialogOptions {
  title: string;
  body?: string;
  okLabel?: string;
  cancelLabel?: string;
  /** OK renders as the danger (destructive) button. */
  destructive?: boolean;
  /** ackDialog: no cancel button, no backdrop dismissal. */
  ackOnly?: boolean;
  onOk?: () => void;
}

interface DialogState {
  dialog: DialogOptions | null;
  open: (dialog: DialogOptions) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));

/**
 * A yes/no question. `onOk` runs only when the user confirms; Cancel and
 * backdrop tap simply close.
 */
export function confirmDialog(
  opts: {
    title: string;
    body?: string;
    okLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  },
  onOk: () => void,
) {
  useDialogStore.getState().open({ ...opts, onOk });
}

/**
 * An acknowledge-only dialog (single OK button) — for moments where the app
 * must not continue under the message, e.g. navigating to a new screen on
 * the OK tap so screen readers don't lose the announcement.
 */
export function ackDialog(title: string, okLabel: string, onOk?: () => void) {
  useDialogStore.getState().open({ title, okLabel, ackOnly: true, onOk });
}
