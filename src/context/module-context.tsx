"use client";

import type { Dispatch, SetStateAction, ReactNode } from 'react';
import { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useRouter } from 'next/navigation';

export type Module = 'power' | 'water';

interface ModuleContextType {
  selectedModule: Module | null;
  setSelectedModule: Dispatch<SetStateAction<Module | null>>;
  clearModule: () => void;
}

export const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [selectedModule, setSelectedModule] = useLocalStorage<Module | null>('paw-app-module', null);
  const router = useRouter();

  const clearModule = useCallback(() => {
    setSelectedModule(null);
    router.push('/');
  }, [setSelectedModule, router]);

  return (
    <ModuleContext.Provider value={{ selectedModule, setSelectedModule, clearModule }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
}
