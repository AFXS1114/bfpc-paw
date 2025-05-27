
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
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, Timestamp } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument, MotherBillDocument, InvoiceData, SignatoryDocument, ReadingPerformerDocument } from "@/types";
import { FileText, Search, Loader2, Download } from "lucide-react";
import { format } from "date-fns";

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Attempting to fix VFS loading
// The error ".default.pdfMake is undefined" suggests pdfFonts.default exists,
// but doesn't have a .pdfMake property. Let's try if .vfs is directly on .default
if ((pdfFonts as any).default && (pdfFonts as any).default.vfs) {
  pdfMake.vfs = (pdfFonts as any).default.vfs;
} else if ((pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
  // Fallback to the most common assignment if the above isn't true
  pdfMake.vfs = (pdfFonts as any).pdfMake.vfs;
} else {
  // If neither typical structure is found, log an error.
  // This might indicate an issue with the vfs_fonts.js file itself or its import.
  console.error("Failed to load pdfMake VFS fonts. pdfFonts structure:", pdfFonts);
}


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

  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
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
    setIsGeneratingPreview(true);
    setInvoiceData(null); 

    try {
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) {
        toast({ title: "Client Not Found", description: "Selected client data could not be found.", variant: "destructive" });
        setIsGeneratingPreview(false);
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
        setIsGeneratingPreview(false);
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
        setIsGeneratingPreview(false);
        return;
      }
      const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;

      if (motherBill.totalConsumption === 0) {
        toast({
          title: "Invalid Mother Bill Data",
          description: `Mother bill for ${selectedBillingMonth} ${selectedBillingYear} has zero total consumption. Cannot calculate rate.`,
          variant: "destructive",
        });
        setIsGeneratingPreview(false);
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
        paymentInstructions: "Please make all checks payable to BULAN FISH PORT COMPLEX.\nPayment can be made at the administration office.",
        signatoryName: signatoryDetails?.name,
        signatoryPosition: signatoryDetails?.position,
        readingPerformerName: readingPerformerDetails?.name,
        readingPerformerPosition: readingPerformerDetails?.position,
      };
      setInvoiceData(generatedInvoiceData);
      toast({
        title: "Invoice Data Ready",
        description: "Invoice data has been prepared. Click 'Export to PDF' to generate the document.",
      });

    } catch (error) {
      console.error("Error generating invoice data: ", error);
      toast({
        title: "Data Preparation Failed",
        description: "Could not prepare invoice data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleExportToPdf = () => {
    if (!invoiceData) {
      toast({ title: "No Invoice Data", description: "Generate invoice data first.", variant: "destructive" });
      return;
    }
    setIsExportingPdf(true);

    const formatCurrency = (amount: number) => {
        return `P${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    
    const data = invoiceData; 

    const documentDefinition: any = {
      content: [
        {
          columns: [
            [
              { text: data.companyName, style: 'header' },
              { text: data.companyAddressLine1, style: 'address' },
              data.companyAddressLine2 ? { text: data.companyAddressLine2, style: 'address' } : null,
            ],
            [
              { text: 'INVOICE', style: 'invoiceTitle', alignment: 'right' },
              { text: `Invoice #: ${data.invoiceNumber}`, alignment: 'right', style: 'small' },
              { text: `Date: ${data.invoiceDate}`, alignment: 'right', style: 'small' },
            ]
          ],
          columnGap: 10,
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 5, 0, 10] },
        {
          columns: [
            [
              { text: 'Bill To:', style: 'subheader' },
              { text: data.clientName, style: 'default' },
              { text: `Stall No: ${data.stallNo}`, style: 'default' },
            ],
            [
              { text: 'Billing Period:', style: 'subheader', alignment: 'right' },
              { text: `${data.billingMonth} ${data.billingYear}`, alignment: 'right', style: 'default' },
            ]
          ],
          columnGap: 10,
          margin: [0, 0, 0, 10]
        },
        {
          style: 'itemsTable',
          table: {
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Description', style: 'tableHeader' },
                { text: 'Prev.\n(kWh)', style: 'tableHeader', alignment: 'right' },
                { text: 'Pres.\n(kWh)', style: 'tableHeader', alignment: 'right' },
                { text: 'Cons.\n(kWh)', style: 'tableHeader', alignment: 'right' },
                { text: 'Rate\n(P/kWh)', style: 'tableHeader', alignment: 'right' },
                { text: 'Amount\n(P)', style: 'tableHeader', alignment: 'right' },
              ],
              [
                'Power Consumption',
                { text: data.clientPreviousReading.toLocaleString(), alignment: 'right' },
                { text: data.clientPresentReading.toLocaleString(), alignment: 'right' },
                { text: data.clientTotalKwh.toLocaleString(), alignment: 'right', bold: true },
                { text: `P${data.basicRate.toFixed(4)}`, alignment: 'right' },
                { text: formatCurrency(data.clientTotalKwh * data.basicRate), alignment: 'right' },
              ]
            ]
          },
          layout: {
             hLineWidth: function (i: number, node: any) { return (i === 0 || i === node.table.body.length) ? 0.5 : 0.5; },
             vLineWidth: function (i: number, node: any) { return 0.5; },
             hLineColor: function (i: number, node: any) { return '#BFBFBF'; },
             vLineColor: function (i: number, node: any) { return '#BFBFBF'; },
             paddingLeft: function(i: number, node: any) { return 4; },
             paddingRight: function(i: number, node: any) { return 4; },
             paddingTop: function(i: number, node: any) { return 2; },
             paddingBottom: function(i: number, node: any) { return 2; }
          }
        },
        {
          margin: [0, 5, 0, 5],
          table: {
            widths: ['*'],
            body: [
                [
                    {
                     text: [
                        { text: 'Rate Calculation Basis (Mother Bill ', style: 'smallHeader' },
                        { text: `${data.billingMonth} ${data.billingYear}):`, style: 'smallHeader', bold: true },
                        { text: ` Total MB Amount: ${formatCurrency(data.motherBillTotalAmount)} \t | \t Total MB Cons: ${data.motherBillTotalConsumption.toLocaleString()} kWh`, style: 'small' }
                      ],
                      fillColor: '#F5F5F5', 
                      border: [true, true, true, true], 
                      borderColor: ['#E0E0E0', '#E0E0E0', '#E0E0E0', '#E0E0E0'],
                      margin: [0, 2]
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
                  ['Subtotal:', { text: formatCurrency(data.amountBeforeVAT), alignment: 'right' }],
                  ['VAT (12%):', { text: formatCurrency(data.vatAmount), alignment: 'right' }],
                  [{ text: 'Total Amount Due:', bold: true, style:'totalAmountKey' }, { text: formatCurrency(data.totalAmountDue), alignment: 'right', bold: true, style:'totalAmountValue' }]
                ]
              },
              layout: 'noBorders'
            }
          ],
          margin: [0, 5, 0, 10]
        },
        { text: '', RFS_spacer: true, margin: [0,0,0,0]},
        data.paymentInstructions ? { text: 'Payment Instructions:', style: 'subheader', margin: [0, 10, 0, 2] } : {text:''},
        data.paymentInstructions ? { text: data.paymentInstructions, style: 'default', margin: [0, 0, 0, 20] } : {text:''},
        {
          columns: [
            (data.readingPerformerName || data.readingPerformerPosition) ? [
              { text: 'Readings Performed by:', style: 'small', margin: [0, 0, 0, 25] }, 
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,2]},
              { text: data.readingPerformerName || '', style: 'default', bold: true },
              { text: data.readingPerformerPosition || '', style: 'small' },
            ] : { text: '' },
            (data.signatoryName || data.signatoryPosition) ? [
              { text: 'Prepared by:', style: 'small', margin: [0, 0, 0, 25] }, 
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,2]},
              { text: data.signatoryName || '', style: 'default', bold: true },
              { text: data.signatoryPosition || '', style: 'small' },
            ] : { text: '' },
          ],
          columnGap: 20,
        },
        { text: 'Thank you for your business!', style: 'small', alignment: 'center', margin: [0, 20, 0, 0] } 
      ],
      defaultStyle: {
        fontSize: 9,
        lineHeight: 1.2,
        font: "Roboto", 
      },
      styles: {
        header: { fontSize: 14, bold: true, margin: [0, 0, 0, 2], color: '#333333' }, // Darker header text
        address: { fontSize: 8, margin: [0,0,0,1], color: '#4A4A4A'}, // Darker address text
        invoiceTitle: { fontSize: 20, bold: true, color: '#1E40AF', margin: [0, 0, 0, 1] }, // Darker blue
        subheader: { fontSize: 10, bold: true, margin: [0, 3, 0, 1], color: '#333333' },
        itemsTable: { margin: [0, 5, 0, 5], fontSize: 8.5 },
        tableHeader: { bold: true, fontSize: 8.5, color: '#1F2937'}, // Darker table header
        summaryTable: { margin: [0,0,0,5], fontSize: 9},
        totalAmountKey: {fontSize: 10, bold:true, color: '#1E40AF'}, // Darker blue
        totalAmountValue: {fontSize: 10, bold:true, color: '#1E40AF'}, // Darker blue
        smallHeader: { fontSize: 8, color: '#4A4A4A'},
        small: { fontSize: 8, color: '#4A4A4A'},
        default: {fontSize: 9, color: '#333333'} // Default text darker
      },
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40], 
      footer: function(currentPage: number, pageCount: number) { 
        return { 
          text: `Page ${currentPage.toString()} of ${pageCount.toString()}`, 
          alignment: 'center',
          style: 'small',
          margin: [0,0,0,20] 
        }; 
      }
    };

    const spacerIndex = documentDefinition.content.findIndex((item: any) => item.RFS_spacer);
    if(spacerIndex !== -1) {
        const estimatedLines = JSON.stringify(data).length / 100; 
        const dynamicMargin = Math.max(0, 300 - (estimatedLines * 10)); 
        (documentDefinition.content[spacerIndex] as any).margin[3] = dynamicMargin;
    }

    try {
      pdfMake.createPdf(documentDefinition).download(`Invoice-${invoiceData.invoiceNumber}.pdf`);
      toast({
        title: "PDF Exported",
        description: `Invoice ${invoiceData.invoiceNumber}.pdf has been downloaded.`,
      });
    } catch(e) {
      console.error("Error exporting PDF with pdfmake: ", e);
      toast({ title: "PDF Export Failed", description: "Could not export invoice to PDF using pdfmake.", variant: "destructive"});
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
              Choose a client and the billing period to generate invoice data.
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
            <Button onClick={handleGenerateInvoicePreview} disabled={isGeneratingPreview || isLoadingClients}>
              {isGeneratingPreview ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate Invoice Data
            </Button>
          </CardContent>
        </Card>

        {isGeneratingPreview && (
            <Card className="shadow-lg mt-6">
                <CardHeader>
                    <CardTitle>Preparing Invoice Data...</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center py-10">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </CardContent>
            </Card>
        )}

        {invoiceData && !isGeneratingPreview && (
          <Card className="shadow-lg mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Invoice Data Ready</CardTitle>
                <CardDescription>Invoice data for {invoiceData.clientName} ({invoiceData.billingMonth} {invoiceData.billingYear}) is ready. Click to export.</CardDescription>
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
                <p className="text-sm text-muted-foreground">
                    The detailed HTML preview has been removed. Click "Export to PDF" to generate the document using pdfmake.
                </p>
                <div className="mt-4 p-4 border rounded-md bg-background text-xs">
                    <h4 className="font-semibold mb-2">Quick Data Summary:</h4>
                    <p><strong>Client:</strong> {invoiceData.clientName} ({invoiceData.stallNo})</p>
                    <p><strong>Period:</strong> {invoiceData.billingMonth} {invoiceData.billingYear}</p>
                    <p><strong>Total kWh:</strong> {invoiceData.clientTotalKwh.toLocaleString()}</p>
                    <p><strong>Total Amount Due:</strong> P{invoiceData.totalAmountDue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}


    