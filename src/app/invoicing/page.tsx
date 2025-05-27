
"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, Timestamp } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument, MotherBillDocument, InvoiceData, SignatoryDocument, ReadingPerformerDocument } from "@/types";
import { FileText, Search, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { InvoiceTemplate } from "@/components/invoice-template";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i); // Last 5 years, current year, next 4 years

export default function InvoicingPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedBillingMonth, setSelectedBillingMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [selectedBillingYear, setSelectedBillingYear] = useState<string>(currentYear.toString());

  const [isGenerating, setIsGenerating] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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

  const handleGenerateInvoicePreview = async () => {
    if (!selectedClientId || !selectedBillingMonth || !selectedBillingYear) {
      toast({ title: "Missing Information", description: "Please select a client, billing month, and year.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setInvoiceData(null); 

    try {
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) {
        toast({ title: "Client Not Found", description: "Selected client data could not be found.", variant: "destructive" });
        setIsGenerating(false);
        return;
      }

      const powerReadingQuery = query(
        collection(db, "power-readings"),
        where("clientId", "==", selectedClientId),
        where("billingMonth", "==", selectedBillingMonth),
        where("billingYear", "==", parseInt(selectedBillingYear, 10)),
        limit(1)
      );
      const powerReadingSnapshot = await getDocs(powerReadingQuery);

      if (powerReadingSnapshot.empty) {
        toast({
          title: "Power Reading Not Found",
          description: `No power reading found for ${client.clientName} for ${selectedBillingMonth} ${selectedBillingYear}.`,
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }
      const powerReadingDoc = powerReadingSnapshot.docs[0].data() as PowerReadingDocument;

      const motherBillQuery = query(
        collection(db, "mother-bills"),
        where("utilityType", "==", "power"),
        where("billingMonth", "==", selectedBillingMonth),
        where("billingYear", "==", parseInt(selectedBillingYear, 10)),
        limit(1)
      );
      const motherBillSnapshot = await getDocs(motherBillQuery);

      if (motherBillSnapshot.empty) {
        toast({
          title: "Mother Bill Not Found",
          description: `No power mother bill found for ${selectedBillingMonth} ${selectedBillingYear}. Cannot generate invoice.`,
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }
      const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;

      if (motherBill.totalConsumption === 0) {
        toast({
          title: "Invalid Mother Bill Data",
          description: `Mother bill for ${selectedBillingMonth} ${selectedBillingYear} has zero total consumption. Cannot calculate rate.`,
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }
      
      const basicRate = motherBill.totalAmountBilled / motherBill.totalConsumption;
      const amountBeforeVAT = basicRate * powerReadingDoc.totalKwh;
      const vatAmount = amountBeforeVAT * 0.12; 
      const totalAmountDue = amountBeforeVAT + vatAmount;

      let signatoryDetails: { name: string; position: string } | undefined = undefined;
      try {
        const signatoriesQuery = query(
          collection(db, "signatories"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const signatorySnapshot = await getDocs(signatoriesQuery);
        if (!signatorySnapshot.empty) {
          const signatoryDoc = signatorySnapshot.docs[0].data() as SignatoryDocument;
          signatoryDetails = { name: signatoryDoc.name, position: signatoryDoc.position };
        }
      } catch (sigError) {
        console.warn("Could not fetch signatory:", sigError);
      }

      let readingPerformerDetails: { name: string; position: string } | undefined = undefined;
      try {
        const readingPerformersQuery = query(
          collection(db, "reading-performers"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const readingPerformerSnapshot = await getDocs(readingPerformersQuery);
        if (!readingPerformerSnapshot.empty) {
          const performerDoc = readingPerformerSnapshot.docs[0].data() as ReadingPerformerDocument;
          readingPerformerDetails = { name: performerDoc.name, position: performerDoc.position };
        }
      } catch (perfError) {
        console.warn("Could not fetch reading performer:", perfError);
      }

      const currentDate = new Date();
      const generatedInvoiceData: InvoiceData = {
        clientName: client.clientName,
        stallNo: client.stallNo,
        billingMonth: selectedBillingMonth,
        billingYear: parseInt(selectedBillingYear, 10),
        clientPreviousReading: powerReadingDoc.previousReading,
        clientPresentReading: powerReadingDoc.presentReading,
        clientTotalKwh: powerReadingDoc.totalKwh,
        motherBillTotalAmount: motherBill.totalAmountBilled,
        motherBillTotalConsumption: motherBill.totalConsumption,
        basicRate: basicRate,
        amountBeforeVAT: amountBeforeVAT,
        vatAmount: vatAmount,
        totalAmountDue: totalAmountDue,
        invoiceNumber: `${client.stallNo.replace(/[^A-Z0-9]/ig, '')}-${selectedBillingYear}${MONTHS.indexOf(selectedBillingMonth).toString().padStart(2, '0')}`,
        invoiceDate: format(currentDate, "MMMM dd, yyyy"),
        companyName: "BULAN FISH PORT COMPLEX",
        companyAddressLine1: "Pier 2, Zone-4, Bulan, Sorsogon",
        companyAddressLine2: "", 
        companyLogoUrl: "/company-logo.png", 
        paymentInstructions: "Please make all checks payable to BULAN FISH PORT COMPLEX.\nPayment can be made at the administration office.",
        signatoryName: signatoryDetails?.name,
        signatoryPosition: signatoryDetails?.position,
        readingPerformerName: readingPerformerDetails?.name,
        readingPerformerPosition: readingPerformerDetails?.position,
      };
      setInvoiceData(generatedInvoiceData);

    } catch (error) {
      console.error("Error generating invoice preview: ", error);
      toast({
        title: "Invoice Generation Failed",
        description: "Could not generate invoice preview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportToPdf = async () => {
    if (!invoiceData) {
      toast({ title: "No Invoice", description: "Generate an invoice preview first.", variant: "destructive" });
      return;
    }
    setIsExportingPdf(true);
    const invoiceElement = document.getElementById('invoice-to-export');
    if (!invoiceElement) {
      toast({ title: "Error", description: "Invoice element not found for PDF export.", variant: "destructive" });
      setIsExportingPdf(false);
      return;
    }

    try {
      const canvas = await html2canvas(invoiceElement, { 
        scale: 1, // Using scale 1 for direct pixel mapping if quality is acceptable
        useCORS: true,
        width: 1122, 
        windowWidth: 1122,
        backgroundColor: '#ffffff' // Ensure a white background for the capture
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); 
      const pdfHeight = pdf.internal.pageSize.getHeight(); 
      
      const imgProps = pdf.getImageProperties(imgData);
      const aspectRatio = imgProps.width / imgProps.height;
      
      const margin = 5; // Minimal margin to maximize content size

      let newImgWidth = pdfWidth - 2 * margin; 
      let newImgHeight = newImgWidth / aspectRatio;

      if (newImgHeight > pdfHeight - 2 * margin) {
          newImgHeight = pdfHeight - 2 * margin; 
          newImgWidth = newImgHeight * aspectRatio;
      }
      
      const xOffset = (pdfWidth - newImgWidth) / 2;
      const yOffset = (pdfHeight - newImgHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, newImgWidth, newImgHeight);
      pdf.save(`Invoice-${invoiceData.invoiceNumber}.pdf`);
    } catch(e) {
        console.error("Error exporting PDF: ", e);
        toast({ title: "PDF Export Failed", description: "Could not export invoice to PDF.", variant: "destructive"});
    } finally {
        setIsExportingPdf(false);
    }
  };


  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Create Invoice" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Select Client and Billing Period
            </CardTitle>
            <CardDescription>
              Choose a client and the billing period to generate an invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="select-client">Client Name</Label>
                <Select
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
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
            </div>
            <Button onClick={handleGenerateInvoicePreview} disabled={isGenerating || isLoadingClients}>
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate Invoice Preview
            </Button>
          </CardContent>
        </Card>

        {isGenerating && (
            <Card className="shadow-lg mt-6">
                <CardHeader>
                    <CardTitle>Generating Invoice...</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center py-10">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </CardContent>
            </Card>
        )}

        {invoiceData && !isGenerating && (
          <Card className="shadow-lg mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Invoice Preview</CardTitle>
                <CardDescription>Review the generated invoice below. Export to PDF when ready.</CardDescription>
              </div>
              <Button onClick={handleExportToPdf} disabled={isExportingPdf}>
                {isExportingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export to PDF
              </Button>
            </CardHeader>
            <CardContent className="p-2 bg-muted/30 overflow-x-auto">
              <InvoiceTemplate data={invoiceData} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
    