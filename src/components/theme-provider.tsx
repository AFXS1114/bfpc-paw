"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ThemeContext, type Theme } from '@/context/theme-context';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'fire-dark', // Default to Fire + Dark theme
  storageKey = 'paw-app-theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useLocalStorage<Theme>(storageKey, defaultTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-fire-dark', 'theme-ocean');
    
    if (theme === 'fire-dark') {
      root.classList.add('theme-fire-dark');
    } else {
      root.classList.add('theme-ocean');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
