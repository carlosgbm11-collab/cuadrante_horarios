import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type UndoEntry = {
  label: string;
  execute: () => Promise<unknown> | void;
};

type UndoCtx = {
  push: (entry: UndoEntry) => void;
  undo: () => Promise<void>;
  canUndo: boolean;
  topLabel: string | null;
  stackSize: number;
};

const UndoContext = createContext<UndoCtx>({
  push: () => {},
  undo: async () => {},
  canUndo: false,
  topLabel: null,
  stackSize: 0,
});

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<UndoEntry[]>([]);
  const stackRef = useRef<UndoEntry[]>([]);
  stackRef.current = stack;

  const push = useCallback((entry: UndoEntry) => {
    setStack((prev) => [...prev, entry]);
  }, []);

  const undo = useCallback(async () => {
    const current = stackRef.current;
    if (current.length === 0) return;
    const last = current[current.length - 1];
    setStack(current.slice(0, -1));
    await Promise.resolve(last.execute());
  }, []);

  const topLabel = stack.length > 0 ? stack[stack.length - 1].label : null;

  return (
    <UndoContext.Provider
      value={{ push, undo, canUndo: stack.length > 0, topLabel, stackSize: stack.length }}
    >
      {children}
    </UndoContext.Provider>
  );
}

export const useUndo = () => useContext(UndoContext);
