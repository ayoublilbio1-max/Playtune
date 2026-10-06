import { useSyncExternalStore } from "react";

/**
 * Tiny shared store (no extra package). Screens read it with a selector:
 *   const songs = useLibrary((s) => s.songs);
 * A component only re-renders when the value its selector returns changes,
 * so selectors must return existing values (never build new objects inside them).
 */
export function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();

  const get = () => state;

  const set = (partial: Partial<T> | ((current: T) => Partial<T>)) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function useStore<S>(selector: (s: T) => S): S {
    return useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state),
    );
  }

  return { get, set, subscribe, useStore };
}
