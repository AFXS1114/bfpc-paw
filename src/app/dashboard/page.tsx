
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Zap, Droplet } from "lucide-react";
import Image from 'next/image';

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Dashboard" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Power Consumption</CardTitle>
              <Zap className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234 kWh</div>
              <p className="text-xs text-muted-foreground">+10% from last month</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Water Usage</CardTitle>
              <Droplet className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">56 m³</div>
              <p className="text-xs text-muted-foreground">+5% from last month</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Billing Amount</CardTitle>
              <BarChart className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₱450.75</div>
              <p className="text-xs text-muted-foreground">For current period</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Consumption Overview</CardTitle>
            <CardDescription>Monthly power and water usage trends.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex items-center justify-center bg-muted/30 rounded-md">
            {/* Placeholder for Chart */}
            <Image 
              src="https://placehold.co/600x300.png" 
              alt="Consumption Chart Placeholder" 
              width={600} 
              height={300}
              data-ai-hint="consumption chart"
              className="rounded-md"
            />
            {/* <p className="text-muted-foreground">Chart will be implemented here.</p> */}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
