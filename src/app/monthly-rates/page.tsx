
"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import type { MotherBillDocument } from "@/types";
import { Tags, ListFilter } from "lucide-react";

const MONTHS_ORDER = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

interface MonthlyRate extends MotherBillDocument {
    calculatedRate: number;
}

export default function MonthlyRatesPage() {
  const { toast } = useToast();
  const [rates, setRates] = useState<MonthlyRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());

  useEffect(() => {
    setIsLoading(true);
    const recordsQuery = query(
      collection(db, "mother-bills"), 
      where("utilityType", "==", "power"),
      where("billingYear", "==", parseInt(selectedYear, 10))
    );
    
    const unsubscribe = onSnapshot(recordsQuery, (querySnapshot) => {
      const recordsData = querySnapshot.docs.map(doc => {
        const data = doc.data() as MotherBillDocument;
        const calculatedRate = data.totalConsumption > 0 ? data.totalAmountBilled / data.totalConsumption : 0;
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate(), 
          calculatedRate,
        } as MonthlyRate;
      });

      // Sort by month order
      recordsData.sort((a, b) => MONTHS_ORDER.indexOf(a.billingMonth) - MONTHS_ORDER.indexOf(b.billingMonth));
      
      setRates(recordsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching power mother bills for rates: ", error);
      toast({
        title: "Error",
        description: "Failed to fetch monthly rate data.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedYear, toast]);

  const formatCurrency = (amount: number, minimumFractionDigits = 2, maximumFractionDigits = 2) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits, maximumFractionDigits })}`;
  };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Monthly Power Rates" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListFilter className="h-6 w-6 text-primary" />
              Filter by Year
            </CardTitle>
            <CardDescription>
                Select a year to view the corresponding monthly rates derived from power mother bills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
                <Label htmlFor="select-year">Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger id="select-year" className="mt-1">
                        <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                    {YEARS.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                        {year}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-6 w-6 text-primary" />
              {`Power Rates for ${selectedYear}`}
            </CardTitle>
            <CardDescription>
              This table displays the calculated rate per kWh based on the total amount and consumption from the power mother bill for each month.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : rates.length === 0 ? (
              <p className="text-muted-foreground text-center">No power mother bill records found for {selectedYear}.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Billing Period</TableHead>
                    <TableHead className="text-right">Total Consumption (kWh)</TableHead>
                    <TableHead className="text-right">Total Amount (₱)</TableHead>
                    <TableHead className="text-right font-bold">Calculated Rate (₱/kWh)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">{rate.billingMonth} {rate.billingYear}</TableCell>
                      <TableCell className="text-right">{rate.totalConsumption.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rate.totalAmountBilled)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(rate.calculatedRate, 4, 4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
