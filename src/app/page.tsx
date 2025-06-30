"use client";

import { useRouter } from 'next/navigation';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Droplet } from "lucide-react";
import { useModule } from '@/context/module-context';
import type { Module } from '@/context/module-context';
import { useTheme } from '@/context/theme-context';

export default function DashboardPage() {
  const { setSelectedModule } = useModule();
  const { setTheme } = useTheme();
  const router = useRouter();

  const handleSelectModule = (module: Module) => {
    setSelectedModule(module);
    if (module === 'power') {
      setTheme('fire-dark');
      router.push('/power');
    } else {
      setTheme('ocean');
      router.push('/water');
    }
  };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Select a Module" />
      <div className="flex flex-1 flex-col items-center justify-center space-y-4 p-4 md:flex-row md:space-y-0 md:space-x-8">
        <Card
          className="w-64 h-64 transform cursor-pointer transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
          onClick={() => handleSelectModule('power')}
        >
          <CardContent className="flex flex-col items-center justify-center h-full p-6">
            <Zap className="h-24 w-24 text-primary mb-4" />
            <span className="text-2xl font-bold tracking-wider">POWER</span>
          </CardContent>
        </Card>
        <Card
          className="w-64 h-64 transform cursor-pointer transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
          onClick={() => handleSelectModule('water')}
        >
          <CardContent className="flex flex-col items-center justify-center h-full p-6">
            <Droplet className="h-24 w-24 text-primary mb-4" />
            <span className="text-2xl font-bold tracking-wider">WATER</span>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
