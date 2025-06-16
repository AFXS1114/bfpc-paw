
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
import { collection, query, where, orderBy, onSnapshot, getDocs, Timestamp, limit } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument, MonthlyClientSummaryData, ClientMonthlyConsumption, MotherBillDocument } from "@/types";
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
    setSelectedClientDetails(null);
  };

  const handleGenerateYearlyForm = async () => {
    if (!selectedClientId || !selectedYear) {
      toast({ title: "Missing Information", description: "Please select a client and year.", variant: "destructive" });
      return;
    }
    setIsLoadingForm(true);
    resetViews();
    const currentClientDetail = clients.find(c => c.id === selectedClientId);
    setSelectedClientDetails(currentClientDetail || null);


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
      setFormTitle(`Reading Form for ${currentClientDetail?.clientName || 'Client'} - ${selectedYear}`);
      toast({ title: "Yearly Form Generated", description: `Reading form for ${currentClientDetail?.clientName || 'client'} for ${selectedYear} is ready.`});
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
    const currentClientDetail = clients.find(c => c.id === selectedClientId);
    setSelectedClientDetails(currentClientDetail || null);

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
      setFormTitle(`All-Time Reading Form for ${currentClientDetail?.clientName || 'Client'}`);
      toast({ title: "All-Time Form Generated", description: `All-time reading form for ${currentClientDetail?.clientName || 'client'} is ready.`});
    } catch (error) {
      console.error("Error generating all-time reading form: ", error);
      toast({ title: "Error", description: "Could not generate all-time reading form.", variant: "destructive" });
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleGenerateMonthlyReadingForm = async () => {
    if (!selectedMonth || !selectedYear) {
      toast({ title: "Missing Information", description: "Please select a month and year for the form.", variant: "destructive" });
      return;
    }
    setIsLoadingForm(true);
    resetViews();
    
    if (clients.length === 0 && !isLoadingClients) {
        toast({ title: "No Clients Found", description: "Cannot generate form without client data.", variant: "destructive" });
        setIsLoadingForm(false);
        return;
    }
    
    try {
      // Fetch Mother Bill for the rate
      let motherBillRate: number | null = null;
      const motherBillQuery = query(
        collection(db, "mother-bills"),
        where("utilityType", "==", "power"),
        where("billingMonth", "==", selectedMonth),
        where("billingYear", "==", parseInt(selectedYear, 10)),
        limit(1)
      );
      const motherBillSnapshot = await getDocs(motherBillQuery);
      if (!motherBillSnapshot.empty) {
        const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;
        if (motherBill.totalConsumption > 0) {
          motherBillRate = motherBill.totalAmountBilled / motherBill.totalConsumption;
        } else {
           toast({ title: "Rate Warning", description: "Mother bill consumption is zero, rate cannot be calculated.", variant: "default" });
        }
      } else {
        toast({ title: "Rate Warning", description: "Mother bill not found for the selected period, rate cannot be displayed.", variant: "default" });
      }

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
          powerMeterNo: client.powerMeterNo, // Added for the new form
          previousReading: readingForClient?.previousReading ?? null,
          presentReading: readingForClient?.presentReading ?? null,
          totalKwh: kwh,
        };
      });
      
      clientConsumptions.sort((a, b) => {
        const stallNoA = parseInt(a.stallNo.replace(/[^0-9]/g, ''), 10);
        const stallNoB = parseInt(b.stallNo.replace(/[^0-9]/g, ''), 10);

        if (!isNaN(stallNoA) && !isNaN(stallNoB) && stallNoA !== stallNoB) {
            return stallNoA - stallNoB;
        }
        return a.stallNo.localeCompare(b.stallNo);
      });


      setMonthlyClientSummaryData({
        month: selectedMonth,
        year: parseInt(selectedYear, 10),
        clientConsumptions,
        overallTotalKwh,
        motherBillRate, // Added for rate display
      });
      setDisplayMode('monthlyClientSummary'); 
      setFormTitle(`Electric Meter Reading Form - ${selectedMonth} ${selectedYear}`);
      toast({ title: "Monthly Reading Form Generated", description: `Form for ${selectedMonth} ${selectedYear} is ready.`});

    } catch (error) {
      console.error("Error generating monthly reading form: ", error);
      toast({ title: "Error", description: "Could not generate monthly reading form.", variant: "destructive" });
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
      const originalOverflow = formElement.style.overflow;
      const originalHeight = formElement.style.height;
      formElement.style.overflow = 'visible';
      formElement.style.height = 'auto';

      const canvas = await html2canvas(formElement, { 
        scale: 2, 
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY 
      });
      
      formElement.style.overflow = originalOverflow;
      formElement.style.height = originalHeight;

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
      
      const w = imgWidth * ratio * 0.95; 
      const h = imgHeight * ratio * 0.95;
      
      const x = (pdfWidth - w) / 2; 
      const y = (pdfHeight - h) / 2; 

      pdf.addImage(imgData, 'PNG', x, y, w, h);
      
      let pdfFilename = `ReadingReport.pdf`;
       if (displayMode === 'yearly' && selectedClientDetails && selectedYear) {
        pdfFilename = `YearlyReadingForm-${selectedClientDetails.stallNo}-${selectedYear}.pdf`;
      } else if (displayMode === 'allTime' && selectedClientDetails) {
        pdfFilename = `AllTimeReadingForm-${selectedClientDetails.stallNo}.pdf`;
      } else if (displayMode === 'monthlyClientSummary' && monthlyClientSummaryData) {
        pdfFilename = `MonthlyReadingForm-${monthlyClientSummaryData.month}-${monthlyClientSummaryData.year}.pdf`;
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

  const renderContentForDisplayMode = () => {
    if (isLoadingForm) {
        return (
            <TableRow>
                <TableCell colSpan={displayMode === 'monthlyClientSummary' ? 6 : 4} className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto my-10 text-primary" />
                </TableCell>
            </TableRow>
        );
    }

    if (displayMode === 'yearly' && yearlyReadings) {
        const readingsWithData = yearlyReadings.filter(reading => reading.previousReading !== null || reading.presentReading !== null || reading.totalKwh !== null);
        if (readingsWithData.length === 0) return <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No readings found for this year.</TableCell></TableRow>;
        return readingsWithData.map((reading) => (
            <TableRow key={reading.month}>
                <TableCell className="font-medium text-xs p-1 border">{reading.month}</TableCell>
                <TableCell className="text-right text-xs p-1 border">{reading.previousReading?.toLocaleString() ?? 'N/A'}</TableCell>
                <TableCell className="text-right text-xs p-1 border">{reading.presentReading?.toLocaleString() ?? 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold text-xs p-1 border">{reading.totalKwh?.toLocaleString() ?? 'N/A'}</TableCell>
            </TableRow>
        ));
    }

    if (displayMode === 'allTime' && allClientReadings) {
        if (allClientReadings.length === 0) return <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No readings found for this client.</TableCell></TableRow>;
        return allClientReadings.map((reading) => (
            <TableRow key={reading.id}>
                <TableCell className="font-medium text-xs p-1 border">{`${reading.billingMonth} ${reading.billingYear}`}</TableCell>
                <TableCell className="text-right text-xs p-1 border">{reading.previousReading?.toLocaleString() ?? 'N/A'}</TableCell>
                <TableCell className="text-right text-xs p-1 border">{reading.presentReading?.toLocaleString() ?? 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold text-xs p-1 border">{reading.totalKwh?.toLocaleString() ?? 'N/A'}</TableCell>
            </TableRow>
        ));
    }

    if (displayMode === 'monthlyClientSummary' && monthlyClientSummaryData) {
        if (monthlyClientSummaryData.clientConsumptions.length === 0) return <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No client consumption data for this period.</TableCell></TableRow>;
        return (
            <>
                {monthlyClientSummaryData.clientConsumptions.map((client) => (
                    <TableRow key={client.clientId}>
                        <TableCell className="text-xs p-1 border">{client.clientName}</TableCell>
                        <TableCell className="text-xs p-1 border">{client.stallNo}</TableCell>
                        <TableCell className="text-xs p-1 border">{client.powerMeterNo}</TableCell>
                        <TableCell className="text-right text-xs p-1 border">{client.previousReading?.toLocaleString() ?? ''}</TableCell>
                        <TableCell className="text-right text-xs p-1 border">{client.presentReading?.toLocaleString() ?? ''}</TableCell>
                        <TableCell className="text-right font-semibold text-xs p-1 border">{client.totalKwh?.toLocaleString() ?? ''}</TableCell>
                    </TableRow>
                ))}
                <TableRow className="bg-muted/20">
                    <TableCell colSpan={5} className="text-right font-bold text-xs p-1 border">TOTAL kWh CONSUMED:</TableCell>
                    <TableCell className="text-right font-bold text-xs p-1 border">{monthlyClientSummaryData.overallTotalKwh.toLocaleString()}</TableCell>
                </TableRow>
            </>
        );
    }
    return <TableRow><TableCell colSpan={displayMode === 'monthlyClientSummary' ? 6 : 4} className="text-center text-muted-foreground py-4">Select parameters and generate a report.</TableCell></TableRow>;
  };
  
  const renderTableHeadersForDisplayMode = () => {
    if (displayMode === 'yearly') {
        return (
            <TableRow>
                <TableHead className="text-xs p-1 border">Month</TableHead>
                <TableHead className="text-right text-xs p-1 border">Prev. Reading</TableHead>
                <TableHead className="text-right text-xs p-1 border">Pres. Reading</TableHead>
                <TableHead className="text-right text-xs p-1 border">Total kWh</TableHead>
            </TableRow>
        );
    }
    if (displayMode === 'allTime') {
        return (
            <TableRow>
                <TableHead className="text-xs p-1 border">Billing Period</TableHead>
                <TableHead className="text-right text-xs p-1 border">Prev. Reading</TableHead>
                <TableHead className="text-right text-xs p-1 border">Pres. Reading</TableHead>
                <TableHead className="text-right text-xs p-1 border">Total kWh</TableHead>
            </TableRow>
        );
    }
    if (displayMode === 'monthlyClientSummary') {
        return (
            <TableRow>
                <TableHead className="text-xs p-1 border">CUSTOMER</TableHead>
                <TableHead className="text-xs p-1 border">LOCATION</TableHead>
                <TableHead className="text-xs p-1 border">METER #</TableHead>
                <TableHead className="text-right text-xs p-1 border">PREVIOUS READING</TableHead>
                <TableHead className="text-right text-xs p-1 border">PRESENT READING</TableHead>
                <TableHead className="text-right text-xs p-1 border">KWH/ CONSUMED</TableHead>
            </TableRow>
        );
    }
    return null; 
  };


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
              Choose options below to generate different types of reading forms.
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
                <Label htmlFor="select-month">Month</Label>
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
                <Button onClick={handleGenerateYearlyForm} variant="outline" disabled={isLoadingForm || isLoadingClients || !selectedClientId || !selectedYear}>
                {isLoadingForm && displayMode === 'yearly' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Eye className="mr-2 h-4 w-4" />
                )}
                Client Yearly Form
                </Button>
                <Button onClick={handleGenerateAllTimeForm} variant="outline" disabled={isLoadingForm || isLoadingClients || !selectedClientId}>
                {isLoadingForm && displayMode === 'allTime' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <History className="mr-2 h-4 w-4" />
                )}
                Client All-Time Form
                </Button>
                 <Button onClick={handleGenerateMonthlyReadingForm} disabled={isLoadingForm || isLoadingClients || !selectedMonth || !selectedYear}>
                {isLoadingForm && displayMode === 'monthlyClientSummary' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <BarChart3 className="mr-2 h-4 w-4" />
                )}
                Generate Monthly Reading Form
                </Button>
            </div>
          </CardContent>
        </Card>

        {(isLoadingForm || displayMode) && (
          <Card className="shadow-lg mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{formTitle}</CardTitle>
                 <CardDescription>{displayMode === 'monthlyClientSummary' ? `Data for ${monthlyClientSummaryData?.month} ${monthlyClientSummaryData?.year}` : (selectedClientDetails ? `Client: ${selectedClientDetails.clientName}`: 'Review data or export.')}</CardDescription>
              </div>
              <Button onClick={handleExportToPdf} disabled={isExportingPdf || isLoadingForm || (!yearlyReadings && !allClientReadings && !monthlyClientSummaryData)}>
                {isExportingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export to PDF
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto bg-background p-2">
                <div id="reading-form-to-export" className="p-4 bg-white text-black max-w-[794px] min-h-[1123px] mx-auto my-4 border shadow-sm"> {/* A4-like container for PDF export */}
                    {/* Conditional Rendering based on displayMode */}
                    {displayMode === 'monthlyClientSummary' && monthlyClientSummaryData && (
                        <>
                            <div className="text-center mb-3">
                                <h3 className="text-sm font-semibold uppercase">Philippine Fisheries Development Authority</h3>
                                <h4 className="text-xs font-semibold uppercase">Bulan Fish Port Complex</h4>
                                <p className="text-xs mt-2 font-bold">Electric Meter Reading Form</p>
                                <p className="text-xs">for the Month of {monthlyClientSummaryData.month} {monthlyClientSummaryData.year}</p>
                            </div>
                            {monthlyClientSummaryData.motherBillRate !== null && (
                                <p className="text-xs mb-2 text-center">
                                    Rate based from Mother Reading: <span className="font-bold underline">{monthlyClientSummaryData.motherBillRate.toFixed(2)}</span> /kWh
                                </p>
                            )}
                            <Table className="w-full border-collapse border border-black">
                                <TableHeader>{renderTableHeadersForDisplayMode()}</TableHeader>
                                <TableBody>{renderContentForDisplayMode()}</TableBody>
                            </Table>
                        </>
                    )}

                    {(displayMode === 'yearly' || displayMode === 'allTime') && selectedClientDetails && (
                        <>
                            <div className="text-center mb-3">
                                <h3 className="text-sm font-semibold uppercase">Client Power Reading Form</h3>
                                <h4 className="text-xs font-semibold uppercase">Bulan Fish Port Complex</h4>
                            </div>
                            <div className="flex justify-between items-start mb-2 text-xs">
                                <div>
                                    <p><strong>Client Name:</strong> {selectedClientDetails.clientName}</p>
                                    <p><strong>Stall No:</strong> {selectedClientDetails.stallNo}</p>
                                </div>
                                <div className="text-right">
                                    <p><strong>Meter No:</strong> {selectedClientDetails.powerMeterNo}</p>
                                    {displayMode === 'yearly' && <p><strong>Year:</strong> {selectedYear}</p>}
                                </div>
                            </div>
                            <Table className="w-full border-collapse border border-black">
                                <TableHeader>{renderTableHeadersForDisplayMode()}</TableHeader>
                                <TableBody>{renderContentForDisplayMode()}</TableBody>
                            </Table>
                            <div className="mt-8 flex justify-around text-[10px]">
                                <div>
                                    <p className="mb-10">Readings Performed By:</p>
                                    <p className="border-t border-black pt-1 text-center">(Signature over Printed Name)</p>
                                </div>
                                <div>
                                    <p className="mb-10">Checked By:</p>
                                    <p className="border-t border-black pt-1 text-center">(Signature over Printed Name)</p>
                                </div>
                            </div>
                        </>
                    )}
                    
                    {/* Fallback for when displayMode is set but no specific data structure matches (should not happen with current logic) */}
                    {isLoadingForm && (
                         <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    )}
                    {!isLoadingForm && !yearlyReadings && !allClientReadings && !monthlyClientSummaryData && (
                        <p className="text-center text-muted-foreground py-10">No data to display for the selected report type.</p>
                    )}
                </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

