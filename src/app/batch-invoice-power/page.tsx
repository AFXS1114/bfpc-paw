
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useMemo } from "react";
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, Timestamp, addDoc, serverTimestamp } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument, MotherBillDocument, InvoiceData, VerifierDocument, InvoiceRecordEntry, MonthlyRateDocument } from "@/types";
import { Search, Loader2, Download, Layers } from "lucide-react";
import { format, isValid } from "date-fns";
import { generatePdf } from '@/lib/invoice-helpers';

const MONTHS_ARRAY = [ 
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function BatchInvoicePowerPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const [powerReadings, setPowerReadings] = useState<PowerReadingDocument[]>([]);
  const [isLoadingReadings, setIsLoadingReadings] = useState(false);
  const [selectedReadingIds, setSelectedReadingIds] = useState<Set<string>>(new Set());

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setIsLoadingClients(true);
    const clientsQuery = query(collection(db, "clients"), orderBy("clientName", "asc"));
    const unsubscribe = onSnapshot(clientsQuery, (querySnapshot) => {
      const clientsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ClientDocument));
      setClients(clientsData);
      setIsLoadingClients(false);
    }, (error) => {
      console.error("Error fetching clients: ", error);
      toast({ title: "Error", description: "Failed to fetch clients.", variant: "destructive" });
      setIsLoadingClients(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const handleFetchReadings = async () => {
    if (!selectedClientId) {
      toast({ title: "Missing Information", description: "Please select a client.", variant: "destructive" });
      setPowerReadings([]);
      setSelectedReadingIds(new Set());
      return;
    }
    setIsLoadingReadings(true);
    setPowerReadings([]);
    setSelectedReadingIds(new Set());

    try {
      const readingsQuery = query(
        collection(db, "power-readings"),
        where("clientId", "==", selectedClientId),
        orderBy("billingYear", "asc"), // Order by year first
        orderBy("billingMonth", "asc") // Then by month
      );
      const snapshot = await getDocs(readingsQuery);
      const fetchedReadings = snapshot.docs.map(doc => {
        const data = doc.data();
        let dateBilled = new Date(); 
        if (data.dateBilled && (data.dateBilled as Timestamp).toDate) {
            dateBilled = (data.dateBilled as Timestamp).toDate();
        } else if (data.dateBilled) { 
            const parsedDate = new Date(data.dateBilled);
            if (isValid(parsedDate)) dateBilled = parsedDate;
        }

        let createdAt = new Date(); 
        if (data.createdAt && (data.createdAt as Timestamp).toDate) {
            createdAt = (data.createdAt as Timestamp).toDate();
        } else if (data.createdAt) {
            const parsedCreatedAt = new Date(data.createdAt);
            if (isValid(parsedCreatedAt)) createdAt = parsedCreatedAt;
        }
        
        return {
          ...data,
          id: doc.id,
          dateBilled: dateBilled,
          createdAt: createdAt,
        } as PowerReadingDocument;
      });
      setPowerReadings(fetchedReadings);
      if (fetchedReadings.length === 0) {
        toast({ title: "No Readings", description: "No power readings found for the selected client.", variant: "default" });
      }
    } catch (error) {
      console.error("Error fetching power readings: ", error);
      toast({ title: "Error", description: "Could not fetch power readings.", variant: "destructive" });
    } finally {
      setIsLoadingReadings(false);
    }
  };
  
  const handleSelectReading = (readingId: string, checked: boolean | string) => {
    setSelectedReadingIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(readingId);
      } else {
        newSet.delete(readingId);
      }
      return newSet;
    });
  };

  const handleSelectAllReadings = (checked: boolean | string) => {
    if (checked) {
      const allIds = new Set(powerReadings.map(r => r.id));
      setSelectedReadingIds(allIds);
    } else {
      setSelectedReadingIds(new Set());
    }
  };

  const isAllSelected = powerReadings.length > 0 && selectedReadingIds.size === powerReadings.length;

  const handleGenerateBatchPdf = async () => {
    if (selectedReadingIds.size === 0) {
      toast({ title: "No Readings Selected", description: "Please select at least one reading to generate an invoice.", variant: "destructive" });
      return;
    }
    
    setIsGeneratingPdf(true);

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) {
      toast({ title: "Client Error", description: "Selected client data not found.", variant: "destructive" });
      setIsGeneratingPdf(false);
      return;
    }

    const lineItems: InvoiceData['lineItems'] = [];
    let overallAmountBeforeVAT = 0;
    let hasErrors = false;

    let signatoryDetails: { name: string; position: string } | undefined = undefined;
    try {
      const signatoriesQuery = query(collection(db, "signatories"), orderBy("createdAt", "desc"), limit(1));
      const signatorySnapshot = await getDocs(signatoriesQuery);
      if (!signatorySnapshot.empty) {
        const signatoryDoc = signatorySnapshot.docs[0].data() as any;
        signatoryDetails = { name: signatoryDoc.name, position: signatoryDoc.position };
      }
    } catch (sigError) { console.warn("Could not fetch signatory for batch:", sigError); }

    let readingPerformerDetails: { name: string; position: string } | undefined = undefined;
    try {
      const readingPerformersQuery = query(collection(db, "reading-performers"), orderBy("createdAt", "desc"), limit(1));
      const readingPerformerSnapshot = await getDocs(readingPerformersQuery);
      if (!readingPerformerSnapshot.empty) {
        const performerDoc = readingPerformerSnapshot.docs[0].data() as any;
        readingPerformerDetails = { name: performerDoc.name, position: performerDoc.position };
      }
    } catch (perfError) { console.warn("Could not fetch reading performer for batch:", perfError); }

    let verifierDetails: { name: string; designation: string } | undefined = undefined;
    try {
      const verifiersQuery = query(collection(db, "verifiers"), orderBy("createdAt", "desc"), limit(1));
      const verifierSnapshot = await getDocs(verifiersQuery);
      if (!verifierSnapshot.empty) {
        const verifierDoc = verifierSnapshot.docs[0].data() as VerifierDocument;
        verifierDetails = { name: verifierDoc.name, designation: verifierDoc.designation };
      }
    } catch (verError) { console.warn("Could not fetch verifier for batch:", verError); }


    for (const readingId of selectedReadingIds) {
      const reading = powerReadings.find(r => r.id === readingId);
      if (!reading) continue;

      try {
        let basicRate = 0;

        // 1. Check for manual rate override first
        const manualRateQuery = query(
          collection(db, "monthly-rates"),
          where("utilityType", "==", "power"),
          where("billingMonth", "==", reading.billingMonth),
          where("billingYear", "==", reading.billingYear),
          limit(1)
        );
        const manualRateSnapshot = await getDocs(manualRateQuery);

        if (!manualRateSnapshot.empty) {
          basicRate = (manualRateSnapshot.docs[0].data() as MonthlyRateDocument).rate;
        } else {
          // 2. Fallback to mother bill
          const motherBillQuery = query(
            collection(db, "mother-bills"),
            where("utilityType", "==", "power"),
            where("billingMonth", "==", reading.billingMonth),
            where("billingYear", "==", reading.billingYear),
            limit(1)
          );
          const motherBillSnapshot = await getDocs(motherBillQuery);

          if (motherBillSnapshot.empty) {
            toast({ title: `Rate Missing`, description: `No manual rate or mother bill for ${reading.billingMonth} ${reading.billingYear}. Skipping.`, variant: "default", duration: 5000 });
            hasErrors = true;
            continue;
          }
          const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;
          if (motherBill.totalConsumption === 0) {
            toast({ title: `Invalid Mother Bill`, description: `Mother bill for ${reading.billingMonth} ${reading.billingYear} has zero consumption. Skipping.`, variant: "default", duration: 5000 });
            hasErrors = true;
            continue;
          }
          basicRate = motherBill.totalAmountBilled / motherBill.totalConsumption;
        }

        const itemAmountBeforeVAT = basicRate * reading.totalKwh;
        overallAmountBeforeVAT += itemAmountBeforeVAT;
        
        lineItems.push({
            description: `Power Consumption - ${reading.billingMonth} ${reading.billingYear}`,
            consumption: reading.totalKwh,
            rate: basicRate,
            amount: itemAmountBeforeVAT,
        });

      } catch (error) {
        console.error(`Error processing reading for ${reading.billingMonth} ${reading.billingYear}:`, error);
        toast({ title: `Error for ${reading.billingMonth} ${reading.billingYear}`, description: "Could not process this reading. Skipping.", variant: "destructive" });
        hasErrors = true;
      }
    }

    if (lineItems.length === 0) {
        toast({ title: "No Billable Items", description: "Could not generate any billable items from the selected readings due to errors.", variant: "destructive" });
        setIsGeneratingPdf(false);
        return;
    }

    lineItems.sort((a, b) => {
        const [monthAStr, yearAStr] = a.description.split(" - ")[1].split(" ");
        const [monthBStr, yearBStr] = b.description.split(" - ")[1].split(" ");
        const yearA = parseInt(yearAStr);
        const yearB = parseInt(yearBStr);
        const monthAIndex = MONTHS_ARRAY.indexOf(monthAStr);
        const monthBIndex = MONTHS_ARRAY.indexOf(monthBStr);

        if (yearA !== yearB) {
            return yearA - yearB;
        }
        return monthAIndex - monthBIndex;
    });

    const overallVatAmount = overallAmountBeforeVAT * 0.12;
    const overallTotalAmountDue = overallAmountBeforeVAT + overallVatAmount;
    const currentDate = new Date();
    const displayInvoiceDate = format(currentDate, "MMMM dd, yyyy");

    const consolidatedInvoiceData: InvoiceData = {
        clientName: client.clientName,
        stallNo: client.stallNo,
        billingMonth: "Various", 
        billingYear: 0,
        consumptionUnit: 'kWh',
        lineItems: lineItems,
        amountBeforeVAT: overallAmountBeforeVAT,
        vatAmount: overallVatAmount,
        totalAmountDue: overallTotalAmountDue,
        invoiceNumber: `${client.stallNo.replace(/[^A-Z0-9]/ig, '')}-BATCH-POWER-ALLTIME`,
        invoiceDate: displayInvoiceDate,
        companyName: "BULAN FISH PORT COMPLEX",
        companyAddressLine1: "Pier 2, Zone-4, Bulan, Sorsogon",
        companyAddressLine2: "", 
        paymentInstructions: "Please make all checks payable to BULAN FISH PORT COMPLEX.\nPayment can be made at the administration office.",
        signatoryName: signatoryDetails?.name,
        signatoryPosition: signatoryDetails?.position,
        readingPerformerName: readingPerformerDetails?.name,
        readingPerformerPosition: readingPerformerDetails?.position,
        verifierName: verifierDetails?.name,
        verifierDesignation: verifierDetails?.designation,
    };
    
    try {
      await generatePdf(consolidatedInvoiceData, 'batch');
      
      const invoiceRecord: Omit<InvoiceRecordEntry, 'id' | 'createdAt' | 'invoiceDate' | 'paidAt'> & { createdAt: any, invoiceDate: any, paidAt?: any } = {
          invoiceNumber: consolidatedInvoiceData.invoiceNumber,
          invoiceType: 'batch',
          utilityType: 'power',
          clientId: client.id,
          clientName: client.clientName,
          stallNo: client.stallNo,
          invoiceDate: serverTimestamp(),
          displayInvoiceDate: consolidatedInvoiceData.invoiceDate,
          billingPeriodDescription: "Consolidated Power - All Selected Periods",
          totalAmountDue: consolidatedInvoiceData.totalAmountDue,
          status: 'unpaid',
          regenerationData: consolidatedInvoiceData,
          createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "invoices"), invoiceRecord);

      if (!hasErrors) {
        toast({ title: "Batch Invoice PDF Exported & Saved", description: `Consolidated power invoice for ${client.clientName} (All Periods) downloaded and record saved.` });
      } else {
        toast({ title: "Batch Invoice PDF Exported & Saved (with Skips)", description: `Consolidated power invoice downloaded and record saved, but some periods were skipped.`, variant: "default", duration: 7000 });
      }
    } catch (e) {
        console.error("Error exporting batch PDF or saving invoice: ", e);
        toast({ title: "PDF Export Failed", description: "Could not export batch power invoice to PDF or save record.", variant: "destructive"});
    } finally {
        setIsGeneratingPdf(false);
    }
  };


  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Batch Power Invoice Generation" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Select Client
            </CardTitle>
            <CardDescription>
              Choose a client to fetch all their power readings for batch invoicing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="select-client">Client Name</Label>
                <Select
                  value={selectedClientId}
                  onValueChange={(value) => { setSelectedClientId(value); setPowerReadings([]); setSelectedReadingIds(new Set());}}
                  disabled={isLoadingClients}
                >
                  <SelectTrigger id="select-client" className="mt-1">
                    <SelectValue placeholder={isLoadingClients ? "Loading clients..." : "Select a client"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((clientDoc) => (
                      <SelectItem key={clientDoc.id} value={clientDoc.id}>
                        {clientDoc.clientName} ({clientDoc.stallNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleFetchReadings} disabled={isLoadingReadings || isLoadingClients || !selectedClientId} className="w-full md:w-auto">
                  {isLoadingReadings ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Layers className="mr-2 h-4 w-4" />
                  )}
                  Fetch Readings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoadingReadings && (
            <Card className="shadow-lg mt-6">
                <CardHeader><CardTitle>Fetching Readings...</CardTitle></CardHeader>
                <CardContent className="flex justify-center items-center py-10">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </CardContent>
            </Card>
        )}

        {powerReadings.length > 0 && !isLoadingReadings && (
          <Card className="shadow-lg mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Select Readings for Consolidated Batch Invoice</CardTitle>
                    <CardDescription>Client: {clients.find(c=>c.id === selectedClientId)?.clientName} - All Recorded Readings</CardDescription>
                </div>
                 <Button onClick={handleGenerateBatchPdf} disabled={isGeneratingPdf || selectedReadingIds.size === 0}>
                    {isGeneratingPdf ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    Generate Consolidated PDF & Save ({selectedReadingIds.size})
                </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                        <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAllReadings}
                            aria-label="Select all readings"
                        />
                    </TableHead>
                    <TableHead>Billing Period</TableHead>
                    <TableHead>Date Billed</TableHead>
                    <TableHead className="text-right">Total kWh</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {powerReadings.map((reading) => (
                    <TableRow key={reading.id} data-state={selectedReadingIds.has(reading.id) ? "selected" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReadingIds.has(reading.id)}
                          onCheckedChange={(checked) => handleSelectReading(reading.id, checked)}
                          aria-label={`Select reading for ${reading.billingMonth} ${reading.billingYear}`}
                        />
                      </TableCell>
                      <TableCell>{reading.billingMonth} {reading.billingYear}</TableCell>
                      <TableCell>{reading.dateBilled ? format(new Date(reading.dateBilled), "MMM dd, yyyy") : 'N/A'}</TableCell>
                      <TableCell className="text-right font-semibold">{reading.totalKwh.toLocaleString()}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={reading.notes}>{reading.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
