"use client";

import { MoonStar, SunDim } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/context/theme-context";
import { Card, CardContent } from "@/components/ui/card";


export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'fire-dark' ? 'ocean' : 'fire-dark');
  };

  const isFireDark = theme === 'fire-dark';

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isFireDark ? <MoonStar className="h-6 w-6 text-primary" /> : <SunDim className="h-6 w-6 text-primary" />}
            <Label htmlFor="theme-switch" className="text-base font-medium text-foreground">
              {isFireDark ? "Fire & Dark Theme" : "Ocean Theme"}
            </Label>
          </div>
          <Switch
            id="theme-switch"
            checked={isFireDark}
            onCheckedChange={toggleTheme}
            aria-label={`Switch to ${isFireDark ? 'Ocean theme' : 'Fire & Dark theme'}`}
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Toggle between the warm, energetic 'Fire & Dark' theme and the calm, refreshing 'Ocean' theme.
        </p>
      </CardContent>
    </Card>
  );
}
