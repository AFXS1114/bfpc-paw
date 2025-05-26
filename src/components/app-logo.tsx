"use client";

import { ShieldCheck } from 'lucide-react';

interface AppLogoProps {
  iconOnly?: boolean;
  className?: string;
}

export function AppLogo({ iconOnly = false, className }: AppLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`} aria-label="PAW App">
      <ShieldCheck className="h-7 w-7 text-primary" />
      {!iconOnly && (
        <span className="text-xl font-bold text-foreground tracking-tight">PAW</span>
      )}
    </div>
  );
}
