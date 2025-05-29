
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
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, Timestamp } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument, MotherBillDocument, InvoiceData } from "@/types";
import { Search, Loader2, Download, Layers } from "lucide-react";
import { format, isValid } from "date-fns";

import pdfMake from "pdfmake/build/pdfmake";
// Try importing vfs_fonts using a default import
import pdfFonts from "pdfmake/build/vfs_fonts";

// Assign VFS fonts to pdfMake
if (pdfFonts && (pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if (pdfFonts && (pdfFonts as any).default && (pdfFonts as any).default.pdfMake && (pdfFonts as any).default.pdfMake.vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).default.pdfMake.vfs;
} else if (pdfFonts && typeof pdfFonts === 'object' && Object.keys(pdfFonts).length > 0 && !(pdfFonts as any).pdfMake) {
    (pdfMake as any).vfs = pdfFonts;
    if (!((pdfMake as any).vfs && Object.keys((pdfMake as any).vfs).length > 0)) {
        (pdfMake as any).vfs = undefined; 
    }
} else {
  console.error("Failed to load pdfMake VFS fonts on Batch Invoice page. Structure of 'pdfFonts':", JSON.stringify(pdfFonts, null, 2));
}


const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export default function BatchInvoicePage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());

  const [powerReadings, setPowerReadings] = useState<PowerReadingDocument[]>([]);
  const [isLoadingReadings, setIsLoadingReadings] = useState(false);
  const [selectedReadingIds, setSelectedReadingIds] = useState<Set<string>>(new Set());

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Fetch clients for the dropdown
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
    if (!selectedClientId || !selectedYear) {
      toast({ title: "Missing Information", description: "Please select a client and year.", variant: "destructive" });
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
        where("billingYear", "==", parseInt(selectedYear, 10)),
        orderBy("billingMonth", "asc") // Order by month to display chronologically
      );
      const snapshot = await getDocs(readingsQuery);
      const fetchedReadings = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          dateBilled: (data.dateBilled as Timestamp)?.toDate ? (data.dateBilled as Timestamp).toDate() : new Date(),
          createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(),
        } as PowerReadingDocument;
      });
      setPowerReadings(fetchedReadings);
      if (fetchedReadings.length === 0) {
        toast({ title: "No Readings", description: "No power readings found for the selected client and year.", variant: "default" });
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

  async function imageToDataUrl(src: string): Promise<string | null> {
    try {
      const response = await fetch(src);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status} ${response.statusText} for src: ${src}`);
        return null;
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting image to data URL:", error);
      return null;
    }
  }
  
  const generateSingleInvoiceContent = (invoiceData: InvoiceData, companyLogoDataUrl: string | null) => {
    const formatCurrency = (amount: number) => `P${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const companyHeader: any[] = [];
      if (companyLogoDataUrl) {
          companyHeader.push({ image: companyLogoDataUrl, width: 50, alignment: 'left' as const, margin: [0, 0, 0, 2] as const });
      }
      companyHeader.push(
          { text: invoiceData.companyName, style: 'header', alignment: 'left' as const, margin: [0,0,0,0] as const},
          { text: invoiceData.companyAddressLine1, style: 'address', alignment: 'left' as const, margin: [0,0,0,0] as const}
      );
      if (invoiceData.companyAddressLine2) {
          companyHeader.push({ text: invoiceData.companyAddressLine2, style: 'address', alignment: 'left' as const, margin: [0,0,0,1] as const });
      }

    return [
      {
        columns: [
          companyHeader,
          [
            { text: `INVOICE`, style: 'invoiceTitle', alignment: 'right' as const },
            { text: `Invoice #: ${invoiceData.invoiceNumber}`, alignment: 'right' as const, style: 'small' },
            { text: `Date: ${invoiceData.invoiceDate}`, alignment: 'right' as const, style: 'small' },
          ]
        ],
        columnGap: 10,
        margin: [0,0,0,10] // Add bottom margin for spacing between invoices
      },
      { canvas: [{ type: 'line' as const, x1: 0, y1: 3, x2: 515, y2: 3, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 3, 0, 5] as const },
      {
        columns: [
          [
            { text: 'Bill To:', style: 'subheader' },
            { text: invoiceData.clientName, style: 'defaultCompact' },
            { text: `Stall No: ${invoiceData.stallNo}`, style: 'defaultCompact' },
          ],
          [
            { text: 'Billing Period:', style: 'subheader', alignment: 'right' as const },
            { text: `${invoiceData.billingMonth} ${invoiceData.billingYear}`, alignment: 'right' as const, style: 'defaultCompact' },
          ]
        ],
        columnGap: 10,
        margin: [0, 0, 0, 5] as const,
      },
      {
        style: 'itemsTable',
        table: {
          widths: ['*', 50, 50, 50, 60, 65], 
          body: [
            [
              { text: 'Description', style: 'tableHeader' },
              { text: 'Prev.\n(kWh)', style: 'tableHeader', alignment: 'right' as const },
              { text: 'Pres.\n(kWh)', style: 'tableHeader', alignment: 'right' as const },
              { text: 'Cons.\n(kWh)', style: 'tableHeader', alignment: 'right' as const },
              { text: 'Rate\n(P/kWh)', style: 'tableHeader', alignment: 'right' as const },
              { text: 'Amount\n(P)', style: 'tableHeader', alignment: 'right' as const },
            ],
            [
              'Power Consumption',
              { text: invoiceData.clientPreviousReading.toLocaleString(), alignment: 'right' as const },
              { text: invoiceData.clientPresentReading.toLocaleString(), alignment: 'right' as const },
              { text: invoiceData.clientTotalKwh.toLocaleString(), alignment: 'right' as const, bold: true },
              { text: `P${invoiceData.basicRate.toFixed(4)}`, alignment: 'right' as const },
              { text: formatCurrency(invoiceData.clientTotalKwh * invoiceData.basicRate), alignment: 'right' as const },
            ]
          ]
        },
        layout: {
           hLineWidth: function (i: number, node: any) { return (i === 0 || i === node.table.body.length) ? 0.5 : 0.5; },
           vLineWidth: function (i: number, node: any) { return 0.5; },
           hLineColor: function (i: number, node: any) { return '#BFBFBF'; },
           vLineColor: function (i: number, node: any) { return '#BFBFBF'; },
           paddingLeft: function(i: number, node: any) { return 3; },
           paddingRight: function(i: number, node: any) { return 3; },
           paddingTop: function(i: number, node: any) { return 1; },
           paddingBottom: function(i: number, node: any) { return 1; }
        }
      },
       {
          margin: [0, 2, 0, 2] as const,
          table: {
            widths: ['*'],
            body: [
                [
                    {
                     text: [
                        { text: 'Rate Basis (MB ', style: 'smallHeader' },
                        { text: `${invoiceData.billingMonth} ${invoiceData.billingYear}):`, style: 'smallHeader', bold: true },
                        { text: ` MB Amt: ${formatCurrency(invoiceData.motherBillTotalAmount)} | MB Cons: ${invoiceData.motherBillTotalConsumption.toLocaleString()} kWh`, style: 'small' }
                      ],
                      fillColor: '#F5F5F5', 
                      border: [true, true, true, true] as const, 
                      borderColor: ['#E0E0E0', '#E0E0E0', '#E0E0E0', '#E0E0E0'] as const,
                      margin: [0, 1] as const,
                    }
                ]
            ]
          },
           layout: 'noBorders'
        },
      {
        columns: [
          { width: '*', text: '' }, 
          {
            width: 'auto',
            style: 'summaryTable',
            table: {
              widths: ['auto', 'auto'],
              body: [
                ['Subtotal:', { text: formatCurrency(invoiceData.amountBeforeVAT), alignment: 'right' as const }],
                ['VAT (12%):', { text: formatCurrency(invoiceData.vatAmount), alignment: 'right' as const }],
                [{ text: 'Total Amount Due:', bold: true, style:'totalAmountKey' }, { text: formatCurrency(invoiceData.totalAmountDue), alignment: 'right' as const, bold: true, style:'totalAmountValue' }]
              ]
            },
            layout: 'noBorders'
          }
        ],
        margin: [0, 2, 0, 5] as const
      },
      { text: '', margin: [0,0,0,5] as const}, 
      invoiceData.paymentInstructions ? { text: 'Payment Instructions:', style: 'subheader', margin: [0, 2, 0, 1] as const } : {text:''}, 
      invoiceData.paymentInstructions ? { text: invoiceData.paymentInstructions, style: 'defaultCompact', margin: [0, 0, 0, 5] as const } : {text:''}, 
      {
          columns: [
              (invoiceData.readingPerformerName || invoiceData.readingPerformerPosition) ? [
                  { text: 'Readings Performed by:', style: 'small', margin: [0, 0, 0, 15] as const }, 
                  { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const},
                  { text: invoiceData.readingPerformerName || '', style: 'defaultCompact', bold: true },
                  { text: invoiceData.readingPerformerPosition || '', style: 'small' },
              ] : {text: ''},
              (invoiceData.signatoryName || invoiceData.signatoryPosition) ? [
                  { text: 'Prepared by:', style: 'small', margin: [0, 0, 0, 15] as const },
                  { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const},
                  { text: invoiceData.signatoryName || '', style: 'defaultCompact', bold: true },
                  { text: invoiceData.signatoryPosition || '', style: 'small' },
              ] : {text: ''},
          ],
          columnGap: 20,
          margin: [0, 10, 0, 0] as const,
      },
      { text: 'Thank you for your business!', style: 'small', alignment: 'center' as const, margin: [0, 5, 0, 0] as const }
    ];
  };

  const handleGenerateBatchPdf = async () => {
    if (selectedReadingIds.size === 0) {
      toast({ title: "No Readings Selected", description: "Please select at least one reading to generate an invoice.", variant: "destructive" });
      return;
    }
    if (!(pdfMake as any).vfs) {
      toast({ title: "PDF Fonts Not Loaded", description: "Cannot generate PDF. Check console/reload.", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) {
      toast({ title: "Client Error", description: "Selected client data not found.", variant: "destructive" });
      setIsGeneratingPdf(false);
      return;
    }

    const companyLogoDataUrl = await imageToDataUrl('/company-logo.png');
    const allInvoiceContents: any[] = [];
    let hasErrors = false;

    // Fetch latest signatory and performer once
    let signatoryDetails: { name: string; position: string } | undefined = undefined;
    try {
      const signatoriesQuery = query(collection(db, "signatories"), orderBy("createdAt", "desc"), limit(1));
      const signatorySnapshot = await getDocs(signatoriesQuery);
      if (!signatorySnapshot.empty) {
        const signatoryDoc = signatorySnapshot.docs[0].data() as any; // SignatoryDocument
        signatoryDetails = { name: signatoryDoc.name, position: signatoryDoc.position };
      }
    } catch (sigError) { console.warn("Could not fetch signatory for batch:", sigError); }

    let readingPerformerDetails: { name: string; position: string } | undefined = undefined;
    try {
      const readingPerformersQuery = query(collection(db, "reading-performers"), orderBy("createdAt", "desc"), limit(1));
      const readingPerformerSnapshot = await getDocs(readingPerformersQuery);
      if (!readingPerformerSnapshot.empty) {
        const performerDoc = readingPerformerSnapshot.docs[0].data() as any; // ReadingPerformerDocument
        readingPerformerDetails = { name: performerDoc.name, position: performerDoc.position };
      }
    } catch (perfError) { console.warn("Could not fetch reading performer for batch:", perfError); }


    for (const readingId of selectedReadingIds) {
      const reading = powerReadings.find(r => r.id === readingId);
      if (!reading) continue;

      try {
        const motherBillQuery = query(
          collection(db, "mother-bills"),
          where("utilityType", "==", "power"),
          where("billingMonth", "==", reading.billingMonth),
          where("billingYear", "==", reading.billingYear),
          limit(1)
        );
        const motherBillSnapshot = await getDocs(motherBillQuery);

        if (motherBillSnapshot.empty) {
          toast({ title: `Mother Bill Missing`, description: `No mother bill for ${reading.billingMonth} ${reading.billingYear}. Skipping invoice for this period.`, variant: "warning", duration: 5000 });
          hasErrors = true;
          continue;
        }
        const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;
        if (motherBill.totalConsumption === 0) {
          toast({ title: `Invalid Mother Bill`, description: `Mother bill for ${reading.billingMonth} ${reading.billingYear} has zero consumption. Skipping.`, variant: "warning", duration: 5000 });
          hasErrors = true;
          continue;
        }

        const basicRate = motherBill.totalAmountBilled / motherBill.totalConsumption;
        const amountBeforeVAT = basicRate * reading.totalKwh;
        const vatAmount = amountBeforeVAT * 0.12; 
        const totalAmountDue = amountBeforeVAT + vatAmount;
        const currentDate = new Date();

        const singleInvoiceData: InvoiceData = {
          clientName: client.clientName,
          stallNo: client.stallNo,
          billingMonth: reading.billingMonth,
          billingYear: reading.billingYear,
          clientPreviousReading: reading.previousReading,
          clientPresentReading: reading.presentReading,
          clientTotalKwh: reading.totalKwh,
          motherBillTotalAmount: motherBill.totalAmountBilled,
          motherBillTotalConsumption: motherBill.totalConsumption,
          basicRate: basicRate,
          amountBeforeVAT: amountBeforeVAT,
          vatAmount: vatAmount,
          totalAmountDue: totalAmountDue,
          invoiceNumber: `${client.stallNo.replace(/[^A-Z0-9]/ig, '')}-${reading.billingYear}${MONTHS.indexOf(reading.billingMonth).toString().padStart(2, '0')}-BATCH`,
          invoiceDate: format(currentDate, "MMMM dd, yyyy"),
          companyName: "BULAN FISH PORT COMPLEX",
          companyAddressLine1: "Pier 2, Zone-4, Bulan, Sorsogon",
          companyAddressLine2: "", 
          paymentInstructions: "Please make all checks payable to BULAN FISH PORT COMPLEX.\nPayment can be made at the administration office.",
          signatoryName: signatoryDetails?.name,
          signatoryPosition: signatoryDetails?.position,
          readingPerformerName: readingPerformerDetails?.name,
          readingPerformerPosition: readingPerformerDetails?.position,
        };
        
        if (allInvoiceContents.length > 0) {
          allInvoiceContents.push({ text: '', pageBreak: 'before' });
        }
        allInvoiceContents.push(...generateSingleInvoiceContent(singleInvoiceData, companyLogoDataUrl));

      } catch (error) {
        console.error(`Error processing invoice for ${reading.billingMonth} ${reading.billingYear}:`, error);
        toast({ title: `Error for ${reading.billingMonth} ${reading.billingYear}`, description: "Could not generate this invoice. Skipping.", variant: "destructive" });
        hasErrors = true;
      }
    }

    if (allInvoiceContents.length === 0 && selectedReadingIds.size > 0) {
        toast({ title: "No Invoices Generated", description: "Could not generate any invoices from the selected readings due to errors.", variant: "destructive" });
        setIsGeneratingPdf(false);
        return;
    }
    if (allInvoiceContents.length === 0) {
        // This case should be caught earlier, but as a fallback
        toast({ title: "No Readings", description: "No readings were selected or valid for invoicing.", variant: "destructive" });
        setIsGeneratingPdf(false);
        return;
    }


    const documentDefinition: any = {
      content: allInvoiceContents,
      defaultStyle: { fontSize: 7.5, lineHeight: 1.0, font: "Roboto" },
      styles: {
        header: { fontSize: 10, bold: true, margin: [0, 0, 0, 1], color: '#333333' }, 
        address: { fontSize: 6.5, margin: [0,0,0,1], color: '#4A4A4A'},
        invoiceTitle: { fontSize: 14, bold: true, color: '#1E40AF', margin: [0, 0, 0, 1] }, 
        subheader: { fontSize: 7.5, bold: true, margin: [0, 1, 0, 1], color: '#333333' }, 
        itemsTable: { margin: [0, 2, 0, 2], fontSize: 6.5 }, 
        tableHeader: { bold: true, fontSize: 6.5, color: '#1F2937'}, 
        summaryTable: { margin: [0,0,0,2], fontSize: 7}, 
        totalAmountKey: {fontSize: 7.5, bold:true, color: '#1E40AF'}, 
        totalAmountValue: {fontSize: 7.5, bold:true, color: '#1E40AF'}, 
        smallHeader: { fontSize: 6, color: '#4A4A4A'}, 
        small: { fontSize: 6, color: '#4A4A4A'}, 
        defaultCompact: {fontSize: 7, color: '#333333'}, 
      },
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [25, 25, 25, 25],
      footer: function(currentPage: number, pageCount: number) { 
        return { text: `Page ${currentPage.toString()} of ${pageCount.toString()}`, alignment: 'center' as const, style: 'small', margin: [0,0,0,10] as const }; 
      }
    };
    
    try {
      pdfMake.createPdf(documentDefinition).download(`BatchInvoice-${client.stallNo}-${selectedYear}.pdf`);
      if (!hasErrors) {
        toast({ title: "Batch Invoice PDF Exported", description: `Combined invoice for ${client.clientName} (${selectedYear}) downloaded.` });
      } else {
        toast({ title: "Batch Invoice PDF Exported with Some Skips", description: `Combined invoice downloaded, but some periods were skipped due to missing data.`, variant: "default", duration: 7000 });
      }
    } catch (e) {
        console.error("Error exporting batch PDF: ", e);
        toast({ title: "PDF Export Failed", description: "Could not export batch invoice to PDF.", variant: "destructive"});
    } finally {
        setIsGeneratingPdf(false);
    }
  };


  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Batch Invoice Generation" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Select Client and Year
            </CardTitle>
            <CardDescription>
              Choose a client and year to fetch their power readings for batch invoicing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
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
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.clientName} ({client.stallNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="select-year">Year</Label>
                 <Select 
                    value={selectedYear} 
                    onValueChange={(value) => { setSelectedYear(value); setPowerReadings([]); setSelectedReadingIds(new Set());}}
                >
                  <SelectTrigger id="select-year" className="mt-1">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleFetchReadings} disabled={isLoadingReadings || isLoadingClients || !selectedClientId || !selectedYear} className="w-full md:w-auto">
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
                    <CardTitle>Select Readings for Batch Invoice</CardTitle>
                    <CardDescription>Client: {clients.find(c=>c.id === selectedClientId)?.clientName} - Year: {selectedYear}</CardDescription>
                </div>
                 <Button onClick={handleGenerateBatchPdf} disabled={isGeneratingPdf || selectedReadingIds.size === 0}>
                    {isGeneratingPdf ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    Generate Batch PDF ({selectedReadingIds.size})
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

    