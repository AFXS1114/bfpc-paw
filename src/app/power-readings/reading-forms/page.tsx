
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, getDocs, Timestamp } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument } from "@/types";
import { FileText, Search, Loader2, Download, Eye } from "lucide-react";
import { format, isValid } from "date-fns";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFontsModule from "pdfmake/build/vfs_fonts";

// Assign VFS fonts to pdfMake
if (pdfFontsModule && (pdfFontsModule as any).pdfMake && (pdfFontsModule as any).pdfMake.vfs) {
  (pdfMake as any).vfs = (pdfFontsModule as any).pdfMake.vfs;
} else if (pdfFontsModule && (pdfFontsModule as any).default && (pdfFontsModule as any).default.pdfMake && (pdfFontsModule as any).default.pdfMake.vfs) {
  // Fallback if the expected structure is on the .default export of the namespace
  (pdfMake as any).vfs = (pdfFontsModule as any).default.pdfMake.vfs;
}
else {
  console.error("Failed to load pdfMake VFS fonts in Reading Forms. pdfFontsModule structure:", pdfFontsModule);
}


const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i); // Last 5 years, current year, next 4 years

interface MonthlyReadingDisplayData {
  month: string;
  dateBilled: string | null;
  previousReading: number | null;
  presentReading: number | null;
  totalKwh: number | null;
  notes: string | null;
}

export default function ReadingFormsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());

  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [yearlyReadings, setYearlyReadings] = useState<MonthlyReadingDisplayData[] | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedClientDetails, setSelectedClientDetails] = useState<ClientDocument | null>(null);

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

  const handleGenerateForm = async () => {
    if (!selectedClientId || !selectedYear) {
      toast({ title: "Missing Information", description: "Please select a client and year.", variant: "destructive" });
      return;
    }
    setIsLoadingForm(true);
    setYearlyReadings(null);
    const clientDetail = clients.find(c => c.id === selectedClientId);
    setSelectedClientDetails(clientDetail || null);

    try {
      const readingsQuery = query(
        collection(db, "power-readings"),
        where("clientId", "==", selectedClientId),
        where("billingYear", "==", parseInt(selectedYear, 10))
      );
      const snapshot = await getDocs(readingsQuery);
      const fetchedReadings = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          dateBilled: (data.dateBilled as Timestamp)?.toDate ? (data.dateBilled as Timestamp).toDate() : null,
        } as PowerReadingDocument;
      });

      const processedReadings: MonthlyReadingDisplayData[] = MONTHS.map(monthName => {
        const readingForMonth = fetchedReadings.find(r => r.billingMonth === monthName);
        return {
          month: monthName,
          dateBilled: readingForMonth?.dateBilled && isValid(new Date(readingForMonth.dateBilled)) ? format(new Date(readingForMonth.dateBilled), "MM/dd/yyyy") : 'N/A',
          previousReading: readingForMonth?.previousReading ?? null,
          presentReading: readingForMonth?.presentReading ?? null,
          totalKwh: readingForMonth?.totalKwh ?? null,
          notes: readingForMonth?.notes || null,
        };
      });
      setYearlyReadings(processedReadings);
      toast({ title: "Form Generated", description: `Reading form for ${clientDetail?.clientName || 'client'} for ${selectedYear} is ready.`});
    } catch (error) {
      console.error("Error generating reading form: ", error);
      toast({ title: "Error", description: "Could not generate reading form.", variant: "destructive" });
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleExportToPdf = async () => {
    if (!yearlyReadings || !selectedClientDetails || !selectedYear) {
      toast({ title: "No Data", description: "Generate the form data first.", variant: "destructive" });
      return;
    }
     if (!(pdfMake as any).vfs) {
      toast({ title: "PDF Fonts Not Loaded", description: "Cannot generate PDF without VFS fonts. Check console and ensure fonts are loaded correctly.", variant: "destructive" });
      return;
    }
    setIsExportingPdf(true);

    const formatNumber = (num: number | null) => num !== null ? num.toLocaleString() : 'N/A';

    const tableBody = [
      [
        { text: 'Month', style: 'tableHeader' },
        { text: 'Date Billed', style: 'tableHeader' },
        { text: 'Prev. Reading', style: 'tableHeader', alignment: 'right' as const },
        { text: 'Pres. Reading', style: 'tableHeader', alignment: 'right' as const },
        { text: 'Total kWh', style: 'tableHeader', alignment: 'right' as const },
        { text: 'Notes', style: 'tableHeader' },
      ],
      ...yearlyReadings.map(r => [
        r.month,
        r.dateBilled || 'N/A',
        { text: formatNumber(r.previousReading), alignment: 'right' as const },
        { text: formatNumber(r.presentReading), alignment: 'right' as const },
        { text: formatNumber(r.totalKwh), alignment: 'right' as const, bold: true },
        r.notes || '',
      ])
    ];

    const documentDefinition: any = {
      content: [
        { text: 'CLIENT POWER READING FORM', style: 'formTitle', alignment: 'center' as const, margin: [0,0,0,10] as const },
        {
          columns: [
            {
              stack: [
                { text: `Client Name: ${selectedClientDetails.clientName}`, style: 'clientInfo' },
                { text: `Stall No: ${selectedClientDetails.stallNo}`, style: 'clientInfo' },
              ]
            },
            {
              stack: [
                { text: `Meter No: ${selectedClientDetails.powerMeterNo}`, style: 'clientInfo', alignment: 'right' as const },
                { text: `Year: ${selectedYear}`, style: 'clientInfo', alignment: 'right' as const },
              ]
            }
          ],
          margin: [0, 0, 0, 15] as const
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', '*'],
            body: tableBody,
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
        { text: ' ', margin: [0, 20, 0, 0] }, // Spacer
        {
          columns: [
            {
              stack: [
                { text: 'Readings Performed By:', style: 'signatureLabel', margin: [0,0,0,25] as const },
                { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5 }] },
                { text: '(Signature over Printed Name)', style: 'signatureCaption' },
              ],
              width: '*'
            },
            {
              stack: [
                { text: 'Checked By:', style: 'signatureLabel', margin: [0,0,0,25] as const },
                { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5 }] },
                { text: '(Signature over Printed Name)', style: 'signatureCaption' },
              ],
              width: '*'
            }
          ],
          columnGap: 20,
        }
      ],
      styles: {
        formTitle: { fontSize: 16, bold: true, color: '#1E40AF' },
        clientInfo: { fontSize: 10, margin: [0, 0, 0, 2] },
        tableHeader: { bold: true, fontSize: 9, color: '#1F2937' },
        signatureLabel: { fontSize: 9, color: '#374151' },
        signatureCaption: { fontSize: 7, italics: true, color: '#6B7280', alignment: 'center' as const },
      },
      defaultStyle: {
        fontSize: 8.5,
        lineHeight: 1.2,
        font: "Roboto",
      },
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [30, 30, 30, 30],
    };

    try {
      pdfMake.createPdf(documentDefinition).download(`ReadingForm-${selectedClientDetails.stallNo}-${selectedYear}.pdf`);
      toast({ title: "PDF Exported", description: "Reading form has been downloaded." });
    } catch (e) {
      console.error("Error exporting PDF: ", e);
      toast({ title: "PDF Export Failed", description: "Could not export form to PDF.", variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Client Reading Forms (Power)" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Select Client and Year
            </CardTitle>
            <CardDescription>
              Choose a client and the year to generate their yearly power reading form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="select-year">Year</Label>
                 <Select value={selectedYear} onValueChange={setSelectedYear}>
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
            </div>
            <Button onClick={handleGenerateForm} disabled={isLoadingForm || isLoadingClients || !selectedClientId}>
              {isLoadingForm ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Generate Reading Form
            </Button>
          </CardContent>
        </Card>

        {isLoadingForm && (
            <Card className="shadow-lg mt-6">
                <CardHeader><CardTitle>Generating Form...</CardTitle></CardHeader>
                <CardContent className="flex justify-center items-center py-10">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </CardContent>
            </Card>
        )}

        {yearlyReadings && !isLoadingForm && selectedClientDetails && (
          <Card className="shadow-lg mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Reading Form for {selectedClientDetails.clientName} - {selectedYear}</CardTitle>
                <CardDescription>Review the readings below or export to PDF.</CardDescription>
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
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Date Billed</TableHead>
                    <TableHead className="text-right">Prev. Reading</TableHead>
                    <TableHead className="text-right">Pres. Reading</TableHead>
                    <TableHead className="text-right">Total kWh</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearlyReadings.map((reading) => (
                    <TableRow key={reading.month}>
                      <TableCell className="font-medium">{reading.month}</TableCell>
                      <TableCell>{reading.dateBilled || 'N/A'}</TableCell>
                      <TableCell className="text-right">{reading.previousReading?.toLocaleString() ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{reading.presentReading?.toLocaleString() ?? 'N/A'}</TableCell>
                      <TableCell className="text-right font-semibold">{reading.totalKwh?.toLocaleString() ?? 'N/A'}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={reading.notes || undefined}>{reading.notes || '-'}</TableCell>
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

    
