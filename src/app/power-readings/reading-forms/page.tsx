
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
import pdfFonts from "pdfmake/build/vfs_fonts";

// VFS Font loading
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
  console.error("Failed to load pdfMake VFS fonts in Reading Forms. Structure of 'pdfFonts':", JSON.stringify(pdfFonts, null, 2));
}


const MONTHS_ARRAY = [ // Renamed to avoid conflict with MONTHS const
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

interface MonthlyReadingDisplayData {
  month: string;
  dateBilled: string | null;
  previousReading: number | null;
  presentReading: number | null;
  totalKwh: number | null;
  notes: string | null; // Keep for on-screen display
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

      const processedReadings: MonthlyReadingDisplayData[] = MONTHS_ARRAY.map(monthName => {
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
      toast({ title: "PDF Export Error", description: "PDF fonts not loaded. Cannot generate PDF. Please refresh and try again.", variant: "destructive" });
      console.error("pdfMake.vfs is not loaded. PDF generation aborted.");
      return;
    }
    
    setIsExportingPdf(true);

    const readingsWithData = yearlyReadings.filter(reading => 
        reading.previousReading !== null || 
        reading.presentReading !== null || 
        reading.totalKwh !== null
    );

    if (readingsWithData.length === 0) {
        toast({ title: "No Data to Export", description: "No readings with data found for the selected client and year.", variant: "default" });
        setIsExportingPdf(false);
        return;
    }

    const tableBody: any[][] = [
      [ // Headers
        { text: 'Month', style: 'tableHeader' },
        { text: 'Date Billed', style: 'tableHeader' },
        { text: 'Prev. Reading\n(kWh)', style: 'tableHeader', alignment: 'right' as const },
        { text: 'Pres. Reading\n(kWh)', style: 'tableHeader', alignment: 'right' as const },
        { text: 'Total kWh', style: 'tableHeader', alignment: 'right' as const },
      ]
    ];

    readingsWithData.forEach(reading => {
      tableBody.push([
        reading.month,
        reading.dateBilled || 'N/A',
        { text: reading.previousReading?.toLocaleString() ?? 'N/A', alignment: 'right' as const },
        { text: reading.presentReading?.toLocaleString() ?? 'N/A', alignment: 'right' as const },
        { text: reading.totalKwh?.toLocaleString() ?? 'N/A', alignment: 'right' as const, bold: true },
      ]);
    });

    const documentDefinition: any = {
      content: [
        { text: 'CLIENT POWER READING FORM', style: 'title', alignment: 'center' as const },
        { text: 'BULAN FISH PORT COMPLEX', style: 'subtitle', alignment: 'center' as const },
        { text: 'Pier 2, Zone-4, Bulan, Sorsogon', style: 'small', alignment: 'center' as const, margin: [0, 0, 0, 10] as const },
        {
          columns: [
            [
              { text: `Client Name: ${selectedClientDetails.clientName}`, style: 'info' },
              { text: `Stall No: ${selectedClientDetails.stallNo}`, style: 'info' },
            ],
            [
              { text: `Meter No: ${selectedClientDetails.powerMeterNo}`, style: 'info', alignment: 'right' as const },
              { text: `Year: ${selectedYear}`, style: 'info', alignment: 'right' as const },
            ]
          ],
          margin: [0, 0, 0, 10] as const
        },
        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto', 'auto'], // Adjusted for 5 columns
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
        {
            columns: [
                {
                    stack: [
                        { text: 'Readings Performed By:', style: 'signatureLabel', margin: [0, 30, 0, 10] as const },
                        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 180, y2: 5, lineWidth: 0.5 }] },
                        { text: '(Signature over Printed Name)', style: 'signatureSublabel', alignment: 'center' as const }
                    ],
                    width: '50%',
                },
                {
                    stack: [
                        { text: 'Checked By:', style: 'signatureLabel', margin: [0, 30, 0, 10] as const },
                        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 180, y2: 5, lineWidth: 0.5 }] },
                        { text: '(Signature over Printed Name)', style: 'signatureSublabel', alignment: 'center' as const }
                    ],
                    width: '50%',
                }
            ],
            columnGap: 20,
            margin: [0, 10, 0, 0] as const,
        }
      ],
      styles: {
        title: { fontSize: 14, bold: true, color: '#1E40AF', margin: [0, 0, 0, 2] as const },
        subtitle: { fontSize: 10, bold: true, margin: [0, 0, 0, 1] as const },
        info: { fontSize: 9, margin: [0, 1, 0, 1] as const },
        tableHeader: { bold: true, fontSize: 8.5, color: '#1F2937' },
        small: { fontSize: 8, color: '#4A4A4A' },
        signatureLabel: { fontSize: 9, bold: false },
        signatureSublabel: { fontSize: 7, italics: true, color: '#555555' },
      },
      defaultStyle: {
        fontSize: 8.5,
        lineHeight: 1.2,
        font: "Roboto", // Ensure Roboto is loaded or use a default like 'Helvetica'
      },
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
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
                  onValueChange={(value) => { setSelectedClientId(value); setYearlyReadings(null); }}
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
                    onValueChange={(value) => { setSelectedYear(value); setYearlyReadings(null); }}
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
            </div>
            <Button onClick={handleGenerateForm} disabled={isLoadingForm || isLoadingClients || !selectedClientId || !selectedYear}>
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
              <Button onClick={handleExportToPdf} disabled={isExportingPdf || !yearlyReadings || !selectedClientDetails}>
                {isExportingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export to PDF
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="p-4 bg-background printable-area"> {/* Changed from bg-white text-black for theme consistency on screen */}
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-primary">CLIENT POWER READING FORM</h2>
                  <p className="text-sm">BULAN FISH PORT COMPLEX</p>
                  <p className="text-xs">Pier 2, Zone-4, Bulan, Sorsogon</p>
                </div>
                <div className="flex justify-between items-start mb-4 text-sm">
                  <div>
                    <p><strong>Client Name:</strong> {selectedClientDetails.clientName}</p>
                    <p><strong>Stall No:</strong> {selectedClientDetails.stallNo}</p>
                  </div>
                  <div className="text-right">
                    <p><strong>Meter No:</strong> {selectedClientDetails.powerMeterNo}</p>
                    <p><strong>Year:</strong> {selectedYear}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs p-1">Month</TableHead>
                      <TableHead className="text-xs p-1">Date Billed</TableHead>
                      <TableHead className="text-right text-xs p-1">Prev. Reading</TableHead>
                      <TableHead className="text-right text-xs p-1">Pres. Reading</TableHead>
                      <TableHead className="text-right text-xs p-1">Total kWh</TableHead>
                      <TableHead className="text-xs p-1">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearlyReadings.map((reading) => (
                      <TableRow key={reading.month}>
                        <TableCell className="font-medium text-xs p-1">{reading.month}</TableCell>
                        <TableCell className="text-xs p-1">{reading.dateBilled || 'N/A'}</TableCell>
                        <TableCell className="text-right text-xs p-1">{reading.previousReading?.toLocaleString() ?? 'N/A'}</TableCell>
                        <TableCell className="text-right text-xs p-1">{reading.presentReading?.toLocaleString() ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-semibold text-xs p-1">{reading.totalKwh?.toLocaleString() ?? 'N/A'}</TableCell>
                        <TableCell className="max-w-[100px] truncate text-xs p-1" title={reading.notes || undefined}>{reading.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-10 flex justify-around text-xs">
                    <div>
                        <p className="mb-12">Readings Performed By:</p>
                        <p className="border-t pt-1 text-center">(Signature over Printed Name)</p>
                    </div>
                    <div>
                        <p className="mb-12">Checked By:</p>
                        <p className="border-t pt-1 text-center">(Signature over Printed Name)</p>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
