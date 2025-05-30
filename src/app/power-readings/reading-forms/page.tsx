
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
import type { ClientDocument, PowerReadingDocument, MonthlyClientSummaryData, ClientMonthlyConsumption } from "@/types";
import { FileText, Search, Loader2, Download, Eye, History, BarChart3 } from "lucide-react";
import { format, isValid } from "date-fns";

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';


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


const MONTHS_ARRAY = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

interface MonthlyReadingDisplayData {
  month: string;
  year?: number; 
  previousReading: number | null;
  presentReading: number | null;
  totalKwh: number | null;
}

export default function ReadingFormsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS_ARRAY[new Date().getMonth()]);


  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [yearlyReadings, setYearlyReadings] = useState<MonthlyReadingDisplayData[] | null>(null);
  const [allClientReadings, setAllClientReadings] = useState<PowerReadingDocument[] | null>(null);
  const [monthlyClientSummaryData, setMonthlyClientSummaryData] = useState<MonthlyClientSummaryData | null>(null);
  const [displayMode, setDisplayMode] = useState<'yearly' | 'allTime' | 'monthlyClientSummary' | null>(null);
  const [formTitle, setFormTitle] = useState<string>("Reading Form Preview");

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

  const clientDetail = clients.find(c => c.id === selectedClientId);

  const resetViews = () => {
    setYearlyReadings(null);
    setAllClientReadings(null);
    setMonthlyClientSummaryData(null);
    setDisplayMode(null);
  };

  const handleGenerateYearlyForm = async () => {
    if (!selectedClientId || !selectedYear) {
      toast({ title: "Missing Information", description: "Please select a client and year.", variant: "destructive" });
      return;
    }
    setIsLoadingForm(true);
    resetViews();
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
        } as PowerReadingDocument;
      });

      const processedReadings: MonthlyReadingDisplayData[] = MONTHS_ARRAY.map(monthName => {
        const readingForMonth = fetchedReadings.find(r => r.billingMonth === monthName);
        return {
          month: monthName,
          previousReading: readingForMonth?.previousReading ?? null,
          presentReading: readingForMonth?.presentReading ?? null,
          totalKwh: readingForMonth?.totalKwh ?? null,
        };
      });
      setYearlyReadings(processedReadings);
      setDisplayMode('yearly');
      setFormTitle(`Reading Form for ${clientDetail?.clientName || 'Client'} - ${selectedYear}`);
      toast({ title: "Yearly Form Generated", description: `Reading form for ${clientDetail?.clientName || 'client'} for ${selectedYear} is ready.`});
    } catch (error) {
      console.error("Error generating yearly reading form: ", error);
      toast({ title: "Error", description: "Could not generate yearly reading form.", variant: "destructive" });
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleGenerateAllTimeForm = async () => {
    if (!selectedClientId) {
      toast({ title: "Client Not Selected", description: "Please select a client.", variant: "destructive" });
      return;
    }
    setIsLoadingForm(true);
    resetViews();
    setSelectedClientDetails(clientDetail || null);

    try {
      const readingsQuery = query(
        collection(db, "power-readings"),
        where("clientId", "==", selectedClientId),
        orderBy("billingYear", "asc") 
      );
      const snapshot = await getDocs(readingsQuery);
      let fetchedReadings = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
        } as PowerReadingDocument;
      });

      fetchedReadings.sort((a, b) => {
        if (a.billingYear !== b.billingYear) {
          return a.billingYear - b.billingYear;
        }
        return MONTHS_ARRAY.indexOf(a.billingMonth) - MONTHS_ARRAY.indexOf(b.billingMonth);
      });

      setAllClientReadings(fetchedReadings);
      setDisplayMode('allTime');
      setFormTitle(`All-Time Reading Form for ${clientDetail?.clientName || 'Client'}`);
      toast({ title: "All-Time Form Generated", description: `All-time reading form for ${clientDetail?.clientName || 'client'} is ready.`});
    } catch (error) {
      console.error("Error generating all-time reading form: ", error);
      toast({ title: "Error", description: "Could not generate all-time reading form.", variant: "destructive" });
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleGenerateMonthlySummary = async () => {
    if (!selectedMonth || !selectedYear) {
      toast({ title: "Missing Information", description: "Please select a month and year for the summary.", variant: "destructive" });
      return;
    }
    setIsLoadingForm(true);
    resetViews();
    
    if (clients.length === 0 && !isLoadingClients) {
        toast({ title: "No Clients Found", description: "Cannot generate summary without client data.", variant: "destructive" });
        setIsLoadingForm(false);
        return;
    }
    
    try {
      const readingsQuery = query(
        collection(db, "power-readings"),
        where("billingMonth", "==", selectedMonth),
        where("billingYear", "==", parseInt(selectedYear, 10))
      );
      const snapshot = await getDocs(readingsQuery);
      const periodReadings = snapshot.docs.map(doc => doc.data() as PowerReadingDocument);

      let overallTotalKwh = 0;
      const clientConsumptions: ClientMonthlyConsumption[] = clients.map(client => {
        const readingForClient = periodReadings.find(r => r.clientId === client.id);
        const kwh = readingForClient?.totalKwh ?? null;
        if (kwh !== null) {
          overallTotalKwh += kwh;
        }
        return {
          clientId: client.id,
          clientName: client.clientName,
          stallNo: client.stallNo,
          previousReading: readingForClient?.previousReading ?? null,
          presentReading: readingForClient?.presentReading ?? null,
          totalKwh: kwh,
        };
      });
      
      clientConsumptions.sort((a, b) => a.clientName.localeCompare(b.clientName));

      setMonthlyClientSummaryData({
        month: selectedMonth,
        year: parseInt(selectedYear, 10),
        clientConsumptions,
        overallTotalKwh,
      });
      setDisplayMode('monthlyClientSummary');
      setFormTitle(`Monthly Client Consumption Summary - ${selectedMonth} ${selectedYear}`);
      toast({ title: "Monthly Summary Generated", description: `Summary for ${selectedMonth} ${selectedYear} is ready.`});

    } catch (error) {
      console.error("Error generating monthly client summary: ", error);
      toast({ title: "Error", description: "Could not generate monthly client summary.", variant: "destructive" });
    } finally {
      setIsLoadingForm(false);
    }
  };


  const handleExportToPdf = async () => {
    if (!displayMode || (!yearlyReadings && !allClientReadings && !monthlyClientSummaryData)) {
      toast({ title: "No Data", description: "Generate the form data first.", variant: "destructive" });
      return;
    }
    
    const formElement = document.getElementById('reading-form-to-export');
    if (!formElement) {
      toast({ title: "Export Error", description: "Could not find content to export.", variant: "destructive" });
      return;
    }

    setIsExportingPdf(true);

    try {
      const canvas = await html2canvas(formElement, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = imgProps.width;
      const imgHeight = imgProps.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const w = imgWidth * ratio;
      const h = imgHeight * ratio;
      
      // Center the image on the PDF page
      const x = (pdfWidth - w) / 2;
      const y = (pdfHeight - h) / 2;

      pdf.addImage(imgData, 'PNG', x, y, w, h);
      
      let pdfFilename = `ReadingReport.pdf`;
       if (displayMode === 'yearly' && selectedClientDetails && selectedYear) {
        pdfFilename = `ReadingForm-${selectedClientDetails.stallNo}-${selectedYear}.pdf`;
      } else if (displayMode === 'allTime' && selectedClientDetails) {
        pdfFilename = `AllTimeReadingForm-${selectedClientDetails.stallNo}.pdf`;
      } else if (displayMode === 'monthlyClientSummary' && monthlyClientSummaryData) {
        pdfFilename = `MonthlyClientSummary-${monthlyClientSummaryData.month}-${monthlyClientSummaryData.year}.pdf`;
      }
      pdf.save(pdfFilename);
      toast({ title: "PDF Exported", description: "Report has been downloaded." });

    } catch (e) {
      console.error("Error exporting PDF with html2canvas: ", e);
      toast({ title: "PDF Export Failed", description: "Could not export report to PDF.", variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };


  const renderTableContent = () => {
    if (isLoadingForm) return <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>;

    if (displayMode === 'yearly' && yearlyReadings) {
      const readingsWithData = yearlyReadings.filter(reading => reading.previousReading !== null || reading.presentReading !== null || reading.totalKwh !== null);
      if (readingsWithData.length === 0) return <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No readings found for this year.</TableCell></TableRow>;
      
      return readingsWithData.map((reading) => (
        <TableRow key={reading.month}>
          <TableCell className="font-medium text-xs p-1">{reading.month}</TableCell>
          <TableCell className="text-right text-xs p-1">{reading.previousReading?.toLocaleString() ?? 'N/A'}</TableCell>
          <TableCell className="text-right text-xs p-1">{reading.presentReading?.toLocaleString() ?? 'N/A'}</TableCell>
          <TableCell className="text-right font-semibold text-xs p-1">{reading.totalKwh?.toLocaleString() ?? 'N/A'}</TableCell>
        </TableRow>
      ));
    }
    if (displayMode === 'allTime' && allClientReadings) {
       if (allClientReadings.length === 0) return <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No readings found for this client.</TableCell></TableRow>;
       return allClientReadings.map((reading) => (
        <TableRow key={reading.id}>
          <TableCell className="font-medium text-xs p-1">{`${reading.billingMonth} ${reading.billingYear}`}</TableCell>
          <TableCell className="text-right text-xs p-1">{reading.previousReading?.toLocaleString() ?? 'N/A'}</TableCell>
          <TableCell className="text-right text-xs p-1">{reading.presentReading?.toLocaleString() ?? 'N/A'}</TableCell>
          <TableCell className="text-right font-semibold text-xs p-1">{reading.totalKwh?.toLocaleString() ?? 'N/A'}</TableCell>
        </TableRow>
      ));
    }
    if (displayMode === 'monthlyClientSummary' && monthlyClientSummaryData) {
        if (monthlyClientSummaryData.clientConsumptions.length === 0) return <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No client consumption data for this period.</TableCell></TableRow>;
        return (
            <>
            {monthlyClientSummaryData.clientConsumptions.map((client) => (
                <TableRow key={client.clientId}>
                    <TableCell className="font-medium text-xs p-1">{client.clientName} ({client.stallNo})</TableCell>
                    <TableCell className="text-right text-xs p-1">{client.previousReading?.toLocaleString() ?? 'N/A'}</TableCell>
                    <TableCell className="text-right text-xs p-1">{client.presentReading?.toLocaleString() ?? 'N/A'}</TableCell>
                    <TableCell className="text-right font-semibold text-xs p-1">{client.totalKwh?.toLocaleString() ?? 'N/A'}</TableCell>
                </TableRow>
            ))}
            <TableRow className="bg-muted/50">
                <TableCell colSpan={3} className="text-right font-bold text-xs p-1">TOTAL kWh CONSUMED:</TableCell>
                <TableCell className="text-right font-bold text-xs p-1">{monthlyClientSummaryData.overallTotalKwh.toLocaleString()} kWh</TableCell>
            </TableRow>
            </>
        );
    }
    return null;
  };

  const renderTableHeaders = () => {
     const commonReadingHeaders = (
        <>
            <TableHead className="text-right text-xs p-1">Prev. Reading</TableHead>
            <TableHead className="text-right text-xs p-1">Pres. Reading</TableHead>
            <TableHead className="text-right text-xs p-1">Total kWh</TableHead>
        </>
     );

    if (displayMode === 'yearly') {
      return (
        <TableRow>
          <TableHead className="text-xs p-1">Month</TableHead>
          {commonReadingHeaders}
        </TableRow>
      );
    }
    if (displayMode === 'allTime') {
      return (
        <TableRow>
          <TableHead className="text-xs p-1">Billing Period</TableHead>
          {commonReadingHeaders}
        </TableRow>
      );
    }
    if (displayMode === 'monthlyClientSummary') {
        return (
            <TableRow>
                <TableHead className="text-xs p-1">Client Name (Stall No.)</TableHead>
                <TableHead className="text-right text-xs p-1">Prev. Reading (kWh)</TableHead>
                <TableHead className="text-right text-xs p-1">Pres. Reading (kWh)</TableHead>
                <TableHead className="text-right text-xs p-1">kWh Consumed</TableHead>
            </TableRow>
        );
    }
    return null;
  };

  let onScreenPreviewTitle = "CLIENT POWER READING FORM"; 
  if (displayMode === 'yearly' && selectedYear && selectedClientDetails) {
    onScreenPreviewTitle = `CLIENT POWER READING FORM - ${selectedClientDetails.clientName} (${selectedYear})`;
  } else if (displayMode === 'allTime' && selectedClientDetails) {
    onScreenPreviewTitle = `ALL-TIME POWER READING FORM - ${selectedClientDetails.clientName}`;
  } else if (displayMode === 'monthlyClientSummary' && monthlyClientSummaryData) {
    onScreenPreviewTitle = `MONTHLY CLIENT POWER CONSUMPTION - ${monthlyClientSummaryData.month} ${monthlyClientSummaryData.year}`;
  }


  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Client Reading Forms (Power)" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Select Report Parameters
            </CardTitle>
            <CardDescription>
              Choose a client for individual forms or select month/year for summary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="select-client">Client Name (for Individual Forms)</Label>
                <Select
                  value={selectedClientId}
                  onValueChange={(value) => { setSelectedClientId(value); resetViews(); }}
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
              <div>
                <Label htmlFor="select-year">Year</Label>
                 <Select 
                    value={selectedYear} 
                    onValueChange={(value) => { setSelectedYear(value); resetViews();}}
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
               <div>
                <Label htmlFor="select-month">Month (for Monthly Summary)</Label>
                 <Select 
                    value={selectedMonth} 
                    onValueChange={(value) => { setSelectedMonth(value); resetViews();}}
                 >
                  <SelectTrigger id="select-month" className="mt-1">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_ARRAY.map((month) => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
                <Button onClick={handleGenerateYearlyForm} disabled={isLoadingForm || isLoadingClients || !selectedClientId || !selectedYear}>
                {isLoadingForm && displayMode === 'yearly' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Eye className="mr-2 h-4 w-4" />
                )}
                Generate Yearly Client Form
                </Button>
                <Button onClick={handleGenerateAllTimeForm} variant="outline" disabled={isLoadingForm || isLoadingClients || !selectedClientId}>
                {isLoadingForm && displayMode === 'allTime' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <History className="mr-2 h-4 w-4" />
                )}
                Generate All-Time Client Form
                </Button>
                 <Button onClick={handleGenerateMonthlySummary} variant="secondary" disabled={isLoadingForm || isLoadingClients || !selectedMonth || !selectedYear}>
                {isLoadingForm && displayMode === 'monthlyClientSummary' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <BarChart3 className="mr-2 h-4 w-4" />
                )}
                Generate Monthly Client Summary
                </Button>
            </div>
          </CardContent>
        </Card>

        {isLoadingForm && (
            <Card className="shadow-lg mt-6">
                <CardHeader><CardTitle>Generating Report...</CardTitle></CardHeader>
                <CardContent className="flex justify-center items-center py-10">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </CardContent>
            </Card>
        )}

        {displayMode && !isLoadingForm && (yearlyReadings || allClientReadings || monthlyClientSummaryData) && (
          <Card className="shadow-lg mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{formTitle}</CardTitle>
                <CardDescription>Review the data below or export to PDF.</CardDescription>
              </div>
              <Button onClick={handleExportToPdf} disabled={isExportingPdf || (!yearlyReadings && !allClientReadings && !monthlyClientSummaryData)}>
                {isExportingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export to PDF
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto bg-background p-2">
                <div id="reading-form-to-export" className="p-4 bg-white max-w-[794px] mx-auto"> {/* Ensure this div has an ID and white background */}
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-bold text-primary">{onScreenPreviewTitle}</h2>
                        <p className="text-sm">BULAN FISH PORT COMPLEX</p>
                        <p className="text-xs">Pier 2, Zone-4, Bulan, Sorsogon</p>
                    </div>
                    { (displayMode === 'yearly' || displayMode === 'allTime') && selectedClientDetails && (
                        <div className="flex justify-between items-start mb-4 text-sm">
                            <div>
                            <p><strong>Client Name:</strong> {selectedClientDetails.clientName}</p>
                            <p><strong>Stall No:</strong> {selectedClientDetails.stallNo}</p>
                            </div>
                            <div className="text-right">
                            <p><strong>Meter No:</strong> {selectedClientDetails.powerMeterNo}</p>
                            {displayMode === 'yearly' && <p><strong>Year:</strong> {selectedYear}</p>}
                            </div>
                        </div>
                    )}
                    <Table>
                        <TableHeader>
                        {renderTableHeaders()}
                        </TableHeader>
                        <TableBody>
                        {renderTableContent() || <TableRow><TableCell colSpan={displayMode === 'monthlyClientSummary' ? 4 : 4} className="text-center text-muted-foreground">No data to display.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                    { displayMode !== 'monthlyClientSummary' && (
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
                    )}
                </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

