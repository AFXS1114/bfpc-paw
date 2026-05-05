"use client";

import { useState, useEffect } from "react";
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

export default function BatchInvoiceGenericPage() {
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
        orderBy("billingYear", "asc"),
        orderBy("billingMonth", "asc")
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
        
        return {
          ...data,
          id: doc.id,
          dateBilled: dateBilled,
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
      toast({ title: "No Readings Selected", description: "Please select at least one reading.", variant: "destructive" });
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

    // Fetch personnel
    let signatoryDetails, performerDetails, verifierDetails;
    try {
      const sigSnap = await getDocs(query(collection(db, "signatories"), orderBy("createdAt", "desc"), limit(1)));
      if (!sigSnap.empty) signatoryDetails = sigSnap.docs[0].data();
      const perfSnap = await getDocs(query(collection(db, "reading-performers"), orderBy("createdAt", "desc"), limit(1)));
      if (!perfSnap.empty) performerDetails = perfSnap.docs[0].data();
      const verSnap = await getDocs(query(collection(db, "verifiers"), orderBy("createdAt", "desc"), limit(1)));
      if (!verSnap.empty) verifierDetails = verSnap.docs[0].data();
    } catch (e) { console.warn("Personnel fetch error:", e); }

    for (const readingId of selectedReadingIds) {
      const reading = powerReadings.find(r => r.id === readingId);
      if (!reading) continue;

      try {
        let basicRate = 0;
        // Check manual rates first
        const rateSnap = await getDocs(query(collection(db, "monthly-rates"), where("utilityType", "==", "power"), where("billingMonth", "==", reading.billingMonth), where("billingYear", "==", reading.billingYear), limit(1)));
        
        if (!rateSnap.empty) {
          basicRate = (rateSnap.docs[0].data() as MonthlyRateDocument).rate;
        } else {
          const mbSnap = await getDocs(query(collection(db, "mother-bills"), where("utilityType", "==", "power"), where("billingMonth", "==", reading.billingMonth), where("billingYear", "==", reading.billingYear), limit(1)));
          if (mbSnap.empty || mbSnap.docs[0].data().totalConsumption === 0) {
            hasErrors = true;
            continue;
          }
          const mb = mbSnap.docs[0].data() as MotherBillDocument;
          basicRate = mb.totalAmountBilled / mb.totalConsumption;
        }

        const itemAmount = basicRate * reading.totalKwh;
        overallAmountBeforeVAT += itemAmount;
        lineItems.push({
            description: `Power Consumption - ${reading.billingMonth} ${reading.billingYear}`,
            consumption: reading.totalKwh,
            rate: basicRate,
            amount: itemAmount,
        });

      } catch (error) {
        console.error("Batch item error:", error);
        hasErrors = true;
      }
    }

    if (lineItems.length === 0) {
        toast({ title: "No Billable Items", description: "No valid rates found for the selected periods.", variant: "destructive" });
        setIsGeneratingPdf(false);
        return;
    }

    lineItems.sort((a, b) => {
        const [mA, yA] = a.description.split(" - ")[1].split(" ");
        const [mB, yB] = b.description.split(" - ")[1].split(" ");
        return (parseInt(yA) - parseInt(yB)) || (MONTHS_ARRAY.indexOf(mA) - MONTHS_ARRAY.indexOf(mB));
    });

    const consolidatedInvoiceData: InvoiceData = {
        clientName: client.clientName,
        stallNo: client.stallNo,
        billingMonth: "Various", 
        billingYear: 0,
        consumptionUnit: 'kWh',
        lineItems: lineItems,
        amountBeforeVAT: overallAmountBeforeVAT,
        vatAmount: overallAmountBeforeVAT * 0.12,
        totalAmountDue: overallAmountBeforeVAT * 1.12,
        invoiceNumber: `${client.stallNo.replace(/[^A-Z0-9]/ig, '')}-BATCH-POWER`,
        invoiceDate: format(new Date(), "MMMM dd, yyyy"),
        companyName: "BULAN FISH PORT COMPLEX",
        companyAddressLine1: "Pier 2, Zone-4, Bulan, Sorsogon",
        paymentInstructions: "Please make all checks payable to BULAN FISH PORT COMPLEX.",
    };

    if (signatoryDetails) { consolidatedInvoiceData.signatoryName = signatoryDetails.name; consolidatedInvoiceData.signatoryPosition = signatoryDetails.position; }
    if (performerDetails) { consolidatedInvoiceData.readingPerformerName = performerDetails.name; consolidatedInvoiceData.readingPerformerPosition = performerDetails.position; }
    if (verifierDetails) { consolidatedInvoiceData.verifierName = verifierDetails.name; consolidatedInvoiceData.verifierDesignation = verifierDetails.designation; }
    
    try {
      await generatePdf(consolidatedInvoiceData, 'batch');
      await addDoc(collection(db, "invoices"), {
          invoiceNumber: consolidatedInvoiceData.invoiceNumber,
          invoiceType: 'batch',
          utilityType: 'power',
          clientId: client.id,
          clientName: client.clientName,
          stallNo: client.stallNo,
          invoiceDate: serverTimestamp(),
          displayInvoiceDate: consolidatedInvoiceData.invoiceDate,
          billingPeriodDescription: "Consolidated Power - Multiple Periods",
          totalAmountDue: consolidatedInvoiceData.totalAmountDue,
          status: 'unpaid',
          regenerationData: consolidatedInvoiceData,
          createdAt: serverTimestamp(),
      } as InvoiceRecordEntry);

      toast({ title: "Batch Invoice Exported", description: `Consolidated invoice for ${client.clientName} downloaded.` });
    } catch (e) {
        toast({ title: "Export Failed", variant: "destructive"});
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
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )}

        {powerReadings.length > 0 && !isLoadingReadings && (
          <Card className="shadow-lg mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Select Readings</CardTitle>
                    <CardDescription>Client: {clients.find(c=>c.id === selectedClientId)?.clientName}</CardDescription>
                </div>
                 <Button onClick={handleGenerateBatchPdf} disabled={isGeneratingPdf || selectedReadingIds.size === 0}>
                    {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export & Save ({selectedReadingIds.size})
                </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                        <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAllReadings} />
                    </TableHead>
                    <TableHead>Billing Period</TableHead>
                    <TableHead>Date Billed</TableHead>
                    <TableHead className="text-right">Total kWh</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {powerReadings.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReadingIds.has(reading.id)}
                          onCheckedChange={(checked) => handleSelectReading(reading.id, checked)}
                        />
                      </TableCell>
                      <TableCell>{reading.billingMonth} {reading.billingYear}</TableCell>
                      <TableCell>{reading.dateBilled ? format(new Date(reading.dateBilled), "MMM dd, yyyy") : 'N/A'}</TableCell>
                      <TableCell className="text-right font-semibold">{reading.totalKwh.toLocaleString()}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{reading.notes || "-"}</TableCell>
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
