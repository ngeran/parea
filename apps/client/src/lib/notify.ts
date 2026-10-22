// Feedback that works on every platform. Alert.alert is a silent NO-OP on
// react-native-web (an empty stub class), so the whole web build used to
// swallow "Location saved", "Request sent" and every confirmation. From
// here on:
//   · informational messages → toast() — cross-platform, non-blocking
//   · confirmations         → confirmDialog() — native Alert dialog with
//     buttons on iOS/Android, window.confirm on web
import { Alert, Platform } from "react-native";
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

/**
 * A yes/no question. `onOk` runs only when the user confirms; on web the
 * blocking window.confirm is the honest, accessible browser primitive
 * (a custom skinned modal can come later).
 */
export function confirmDialog(
  opts: {
    title: string;
    body?: string;
    okLabel?: string;
    cancelLabel?: string;
    /** Styles the OK action as destructive on native. */
    destructive?: boolean;
  },
  onOk: () => void,
) {
  if (Platform.OS === "web") {
    if (window.confirm(opts.body ? `${opts.title}\n\n${opts.body}` : opts.title)) onOk();
    return;
  }
  Alert.alert(opts.title, opts.body, [
    { text: opts.cancelLabel ?? "Cancel", style: "cancel" },
    {
      text: opts.okLabel ?? "OK",
      style: opts.destructive ? "destructive" : "default",
      onPress: onOk,
    },
  ]);
}

/**
 * An acknowledge-only dialog (single OK button) — for moments where the app
 * must not continue under the message, e.g. navigating to a new screen on
 * the OK tap so screen readers don't lose the announcement.
 */
export function ackDialog(title: string, okLabel: string, onOk?: () => void) {
  if (Platform.OS === "web") {
    window.alert(title);
    onOk?.();
    return;
  }
  Alert.alert(title, undefined, [{ text: okLabel, onPress: onOk }]);
}
