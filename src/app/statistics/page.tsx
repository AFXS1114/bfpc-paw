
"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import type { MotherBillDocument, PowerReadingDocument, MonthlyStatisticsData } from "@/types";
import { BarChartHorizontalBig, Search, Loader2, AlertTriangle } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export default function StatisticsPage() {
  const { toast } = useToast();
  const [selectedBillingMonth, setSelectedBillingMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [selectedBillingYear, setSelectedBillingYear] = useState<string>(currentYear.toString());
  const [statisticsData, setStatisticsData] = useState<MonthlyStatisticsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleFetchStatistics = async () => {
    if (!selectedBillingMonth || !selectedBillingYear) {
      toast({ title: "Missing Information", description: "Please select a billing month and year.", variant: "destructive" });
      return;
    }
    setIsLoadingStats(true);
    setStatisticsData(null);
    setErrorMessage(null);
    console.log("Fetching statistics for:", selectedBillingMonth, selectedBillingYear);

    try {
      // 1. Fetch Mother Bill (Power)
      const motherBillQuery = query(
        collection(db, "mother-bills"),
        where("utilityType", "==", "power"),
        where("billingMonth", "==", selectedBillingMonth),
        where("billingYear", "==", parseInt(selectedBillingYear, 10)),
        limit(1)
      );
      const motherBillSnapshot = await getDocs(motherBillQuery);

      if (motherBillSnapshot.empty) {
        setErrorMessage(`No power mother bill found for ${selectedBillingMonth} ${selectedBillingYear}.`);
        setIsLoadingStats(false);
        console.warn("Mother bill not found for the period.");
        return;
      }
      const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;
      console.log("Mother Bill Data:", motherBill);

      // 2. Fetch All Client Power Readings for the period
      const powerReadingsQuery = query(
        collection(db, "power-readings"),
        where("billingMonth", "==", selectedBillingMonth),
        where("billingYear", "==", parseInt(selectedBillingYear, 10))
      );
      const powerReadingsSnapshot = await getDocs(powerReadingsQuery);
      const clientReadings = powerReadingsSnapshot.docs.map(doc => doc.data() as PowerReadingDocument);
      console.log("Client Readings Data (count):", clientReadings.length, clientReadings);

      // 3. Calculations
      const motherBillTotalKwh = motherBill.totalConsumption;
      const motherBillTotalAmountBilled = motherBill.totalAmountBilled;
      const clientsTotalKwh = clientReadings.reduce((sum, reading) => sum + reading.totalKwh, 0);
      const officeKwh = motherBillTotalKwh - clientsTotalKwh;
      
      console.log("Raw Calculation Inputs:");
      console.log("  motherBill.totalConsumption (motherBillTotalKwh):", motherBillTotalKwh);
      console.log("  motherBill.totalAmountBilled:", motherBillTotalAmountBilled);
      console.log("  Sum of clientReadings.totalKwh (clientsTotalKwh):", clientsTotalKwh);

      let monthlyRate = 0;
      if (motherBillTotalKwh > 0) {
        monthlyRate = motherBillTotalAmountBilled / motherBillTotalKwh;
      } else if (motherBillTotalKwh === 0 && motherBillTotalAmountBilled > 0) {
        toast({
          title: "Rate Calculation Note",
          description: "Mother bill total consumption is zero. Rate calculation might not reflect fixed charges if any.",
          variant: "default"
        });
      }
      console.log("Calculated monthlyRate (unrounded):", monthlyRate);

      const clientsTotalAmount = clientsTotalKwh * monthlyRate;
      console.log("Calculated clientsTotalAmount (unrounded):", clientsTotalAmount, "=", clientsTotalKwh, "*", monthlyRate);
      
      const officeOnlyTotalAmount = motherBillTotalAmountBilled - clientsTotalAmount;
      console.log("Calculated officeOnlyTotalAmount (unrounded):", officeOnlyTotalAmount, "=", motherBillTotalAmountBilled, "-", clientsTotalAmount);

      setStatisticsData({
        billingPeriod: `${selectedBillingMonth} ${selectedBillingYear}`,
        motherBillTotalKwh,
        clientsTotalKwh,
        officeKwh,
        monthlyRate,
        clientsTotalAmount,
        officeOnlyTotalAmount,
        motherBillTotalAmountBilled,
      });

    } catch (error) {
      console.error("Error fetching statistics: ", error);
      setErrorMessage("Failed to fetch statistics. Please try again.");
      toast({ title: "Error", description: "Could not fetch statistics.", variant: "destructive" });
    } finally {
      setIsLoadingStats(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Power Statistics" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Select Billing Period
            </CardTitle>
            <CardDescription>
              Choose the month and year to view power consumption and financial statistics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="select-billing-month">Billing Month</Label>
                <Select value={selectedBillingMonth} onValueChange={setSelectedBillingMonth}>
                  <SelectTrigger id="select-billing-month" className="mt-1">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="select-billing-year">Billing Year</Label>
                 <Select value={selectedBillingYear} onValueChange={setSelectedBillingYear}>
                  <SelectTrigger id="select-billing-year" className="mt-1">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleFetchStatistics} disabled={isLoadingStats} className="w-full md:w-auto">
                {isLoadingStats ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BarChartHorizontalBig className="mr-2 h-4 w-4" />
                )}
                Fetch Statistics
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoadingStats && (
          <Card className="shadow-lg mt-6">
            <CardHeader><CardTitle>Loading Statistics...</CardTitle></CardHeader>
            <CardContent className="py-10 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
            </CardContent>
          </Card>
        )}

        {errorMessage && !isLoadingStats && (
          <Card className="shadow-lg mt-6 border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" /> Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{errorMessage}</p>
            </CardContent>
          </Card>
        )}

        {statisticsData && !isLoadingStats && !errorMessage && (
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Consumption Breakdown (kWh)</CardTitle>
                <CardDescription>{statisticsData.billingPeriod}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Total Clients' kWh:</span>
                  <span className="font-semibold">{statisticsData.clientsTotalKwh.toLocaleString()} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span>Office kWh:</span>
                  <span className="font-semibold">{statisticsData.officeKwh.toLocaleString()} kWh</span>
                </div>
                <hr className="my-2"/>
                <div className="flex justify-between font-bold text-base text-primary">
                  <span>Mother Bill Total kWh:</span>
                  <span>{statisticsData.motherBillTotalKwh.toLocaleString()} kWh</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Financial Breakdown (PHP)</CardTitle>
                <CardDescription>{statisticsData.billingPeriod}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Monthly Rate:</span>
                  <span className="font-semibold">{formatCurrency(statisticsData.monthlyRate)} / kWh</span>
                </div>
                 <div className="flex justify-between">
                  <span>Clients' Total Amount:</span>
                  <span className="font-semibold">{formatCurrency(statisticsData.clientsTotalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Office Only Total Amount:</span>
                  <span className="font-semibold">{formatCurrency(statisticsData.officeOnlyTotalAmount)}</span>
                </div>
                <hr className="my-2"/>
                <div className="flex justify-between font-bold text-base text-primary">
                  <span>Mother Bill Total Amount:</span>
                  <span>{formatCurrency(statisticsData.motherBillTotalAmountBilled)}</span>
                </div>
                 <p className="text-xs text-muted-foreground pt-2">
                  Note: Discrepancies may occur due to rounding or if client billing includes VAT while these calculations are pre-VAT.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
