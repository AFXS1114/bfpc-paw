"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import Image from 'next/image';

export default function WaterPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Water Management" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Record New Water Reading</CardTitle>
            <CardDescription>Enter the details from your water meter.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reading-date">Reading Date</Label>
                <Input id="reading-date" type="date" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="reading-value">Meter Reading (m³)</Label>
                <Input id="reading-value" type="number" placeholder="e.g., 123.45" className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" placeholder="Any relevant notes about this reading..." className="mt-1" />
            </div>
            <Button className="w-full md:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Reading
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Water Usage History</CardTitle>
            <CardDescription>View your past water readings and usage trends.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-muted/30 rounded-md">
            {/* Placeholder for Chart/Table */}
            <Image 
              src="https://placehold.co/500x250.png" 
              alt="Water History Chart Placeholder" 
              width={500} 
              height={250}
              data-ai-hint="water history"
              className="rounded-md"
            />
            {/* <p className="text-muted-foreground">Water readings history chart/table will be here.</p> */}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
