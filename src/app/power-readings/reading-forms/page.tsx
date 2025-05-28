
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

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';


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
    
    const input = document.getElementById('reading-form-to-export');
    if (!input) {
      toast({ title: "Export Error", description: "Could not find the form content to export.", variant: "destructive" });
      return;
    }

    setIsExportingPdf(true);

    try {
      const canvas = await html2canvas(input, {
        scale: 2, // Increase scale for better quality
        useCORS: true,
        logging: false,
        windowWidth: input.scrollWidth,
        windowHeight: input.scrollHeight,
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt', // points
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      // Center the image on the PDF page
      const x = (pdfWidth - scaledWidth) / 2;
      const y = 15; // Small top margin

      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
      pdf.save(`ReadingForm-${selectedClientDetails.stallNo}-${selectedYear}.pdf`);
      
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
              <div id="reading-form-to-export" className="p-4 bg-white text-black printable-area">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-blue-700">CLIENT POWER READING FORM</h2>
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
                      <TableHead className="text-xs border border-gray-400 p-1">Month</TableHead>
                      <TableHead className="text-xs border border-gray-400 p-1">Date Billed</TableHead>
                      <TableHead className="text-right text-xs border border-gray-400 p-1">Prev. Reading</TableHead>
                      <TableHead className="text-right text-xs border border-gray-400 p-1">Pres. Reading</TableHead>
                      <TableHead className="text-right text-xs border border-gray-400 p-1">Total kWh</TableHead>
                      <TableHead className="text-xs border border-gray-400 p-1">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearlyReadings.map((reading) => (
                      <TableRow key={reading.month}>
                        <TableCell className="font-medium text-xs border border-gray-400 p-1">{reading.month}</TableCell>
                        <TableCell className="text-xs border border-gray-400 p-1">{reading.dateBilled || 'N/A'}</TableCell>
                        <TableCell className="text-right text-xs border border-gray-400 p-1">{reading.previousReading?.toLocaleString() ?? 'N/A'}</TableCell>
                        <TableCell className="text-right text-xs border border-gray-400 p-1">{reading.presentReading?.toLocaleString() ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-semibold text-xs border border-gray-400 p-1">{reading.totalKwh?.toLocaleString() ?? 'N/A'}</TableCell>
                        <TableCell className="max-w-[100px] truncate text-xs border border-gray-400 p-1" title={reading.notes || undefined}>{reading.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-10 flex justify-around text-xs">
                    <div>
                        <p className="mb-12">Readings Performed By:</p>
                        <p className="border-t border-gray-500 pt-1 text-center">(Signature over Printed Name)</p>
                    </div>
                    <div>
                        <p className="mb-12">Checked By:</p>
                        <p className="border-t border-gray-500 pt-1 text-center">(Signature over Printed Name)</p>
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
    
