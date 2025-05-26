"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Users, FileText } from "lucide-react";
import Image from "next/image";

export default function BillingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Billing Management" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Mother Bill Entry
            </CardTitle>
            <CardDescription>Input the main utility bill details to distribute costs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="billing-period">Billing Period</Label>
                <Input id="billing-period" type="month" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="mother-bill-amount">Total Bill Amount ($)</Label>
                <Input id="mother-bill-amount" type="number" placeholder="e.g., 500.00" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="total-consumption">Total Consumption (Units)</Label>
                <Input id="total-consumption" type="number" placeholder="e.g., 1500 kWh or 100 m³" className="mt-1" />
              </div>
            </div>
            <Button className="w-full md:w-auto">
              <DollarSign className="mr-2 h-4 w-4" /> Save Mother Bill
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Tenant Bill Calculation
            </CardTitle>
            <CardDescription>Distribute the mother bill costs among tenants based on their usage.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Select a mother bill and input tenant readings to calculate individual shares.</p>
            {/* Placeholder for tenant input and calculation display */}
            <div className="space-y-4">
              {/* Example Tenant Entry */}
              <div className="p-4 border rounded-md bg-background">
                <h4 className="font-medium">Tenant 1: John Doe</h4>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="tenant1-power">Power Usage (kWh)</Label>
                    <Input id="tenant1-power" type="number" placeholder="e.g., 350" className="mt-1"/>
                  </div>
                  <div>
                    <Label htmlFor="tenant1-water">Water Usage (m³)</Label>
                    <Input id="tenant1-water" type="number" placeholder="e.g., 15" className="mt-1"/>
                  </div>
                </div>
                <p className="mt-3 font-semibold text-primary">Calculated Bill: $XX.XX</p>
              </div>
            </div>
            <Button variant="outline" className="mt-4">Add Tenant</Button>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Billing Summary</CardTitle>
            <CardDescription>Overview of billing distribution and history.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-muted/30 rounded-md">
             <Image 
              src="https://placehold.co/500x250.png" 
              alt="Billing Summary Chart Placeholder" 
              width={500} 
              height={250}
              data-ai-hint="billing summary"
              className="rounded-md"
            />
            {/* <p className="text-muted-foreground">Billing summary chart will be here.</p> */}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
