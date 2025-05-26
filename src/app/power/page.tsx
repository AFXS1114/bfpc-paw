
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Loader2, Info } from "lucide-react";
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import type { ClientDocument, PowerReadingEntry } from "@/types";

const powerReadingFormSchema = z.object({
  dateBilled: z.date({ required_error: "Date billed is required." }),
  clientId: z.string().min(1, "Client selection is required."),
  billingMonth: z.string().min(1, "Billing month is required."),
  billingYear: z.coerce.number().min(2000, "Invalid year.").max(new Date().getFullYear() + 5, "Invalid year."),
  previousReading: z.coerce.number().min(0, "Previous reading must be non-negative."),
  presentReading: z.coerce.number().min(0, "Present reading must be non-negative."),
  notes: z.string().optional(),
}).refine(data => data.presentReading >= data.previousReading, {
  message: "Present reading must be greater than or equal to previous reading.",
  path: ["presentReading"],
});

type PowerReadingFormData = z.infer<typeof powerReadingFormSchema>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function PowerPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [selectedClientInfo, setSelectedClientInfo] = useState<{ stallNo: string; powerMeterNo: string } | null>(null);

  const form = useForm<PowerReadingFormData>({
    resolver: zodResolver(powerReadingFormSchema),
    defaultValues: {
      dateBilled: new Date(),
      clientId: "",
      billingMonth: MONTHS[new Date().getMonth()],
      billingYear: new Date().getFullYear(),
      previousReading: 0,
      presentReading: 0,
      notes: "",
    },
  });

  const { watch, setValue } = form;
  const selectedClientId = watch("clientId");
  const previousReading = watch("previousReading");
  const presentReading = watch("presentReading");

  const totalKwh = useMemo(() => {
    const prev = Number(previousReading);
    const pres = Number(presentReading);
    if (!isNaN(prev) && !isNaN(pres) && pres >= prev) {
      return pres - prev;
    }
    return 0;
  }, [previousReading, presentReading]);

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
      toast({
        title: "Error",
        description: "Failed to fetch clients.",
        variant: "destructive",
      });
      setIsLoadingClients(false);
    });

    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setSelectedClientInfo({ stallNo: client.stallNo, powerMeterNo: client.powerMeterNo });
      } else {
        setSelectedClientInfo(null);
      }
    } else {
      setSelectedClientInfo(null);
    }
  }, [selectedClientId, clients]);

  async function onSubmit(data: PowerReadingFormData) {
    setIsSubmitting(true);
    const client = clients.find(c => c.id === data.clientId);
    if (!client) {
      toast({ title: "Error", description: "Selected client not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    try {
      const powerReadingData: Omit<PowerReadingEntry, 'id' | 'createdAt'> = {
        clientId: client.id,
        clientName: client.clientName,
        stallNo: client.stallNo,
        powerMeterNo: client.powerMeterNo,
        dateBilled: Timestamp.fromDate(data.dateBilled),
        billingMonth: data.billingMonth,
        billingYear: data.billingYear,
        previousReading: data.previousReading,
        presentReading: data.presentReading,
        totalKwh: data.presentReading - data.previousReading,
        notes: data.notes || "",
      };

      await addDoc(collection(db, "power-readings"), {
        ...powerReadingData,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Power Reading Saved",
        description: `Reading for ${client.clientName} for ${data.billingMonth} ${data.billingYear} saved.`,
      });
      form.reset({
        dateBilled: new Date(),
        clientId: "",
        billingMonth: MONTHS[new Date().getMonth()],
        billingYear: new Date().getFullYear(),
        previousReading: 0,
        presentReading: 0,
        notes: "",
      });
      setSelectedClientInfo(null);
    } catch (error) {
      console.error("Error saving power reading: ", error);
      toast({
        title: "Error",
        description: "Failed to save power reading. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Power Management" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Record New Power Reading</CardTitle>
            <CardDescription>Enter the power meter reading details for a client.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="dateBilled"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date Billed</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Client</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingClients}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingClients ? "Loading clients..." : "Select a client"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!isLoadingClients && clients.length === 0 && <SelectItem value="no-clients" disabled>No clients found</SelectItem>}
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.clientName} ({client.stallNo})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {selectedClientInfo && (
                  <Card className="bg-muted/50 p-4">
                    <CardHeader className="p-0 pb-2">
                       <CardTitle className="text-lg flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Client Details</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <p><span className="font-medium">Stall No:</span> {selectedClientInfo.stallNo}</p>
                      <p><span className="font-medium">Power Meter No:</span> {selectedClientInfo.powerMeterNo}</p>
                    </CardContent>
                  </Card>
                )}

                <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-md">
                  <legend className="text-sm font-medium px-1">Billing Period</legend>
                  <FormField
                    control={form.control}
                    name="billingMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Month</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select month" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MONTHS.map((month) => (
                              <SelectItem key={month} value={month}>
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="YYYY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="previousReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Previous Reading (kWh)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 12000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="presentReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Present Reading (kWh)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Total Consumption (kWh)</FormLabel>
                    <Input type="number" value={totalKwh} readOnly className="bg-muted/80 font-semibold" />
                  </FormItem>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any relevant notes about this reading..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingClients}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Power Reading
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Power Consumption History</CardTitle>
            <CardDescription>View past power readings and usage trends for clients.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-muted/30 rounded-md">
            <Image 
              src="https://placehold.co/500x250.png" 
              alt="Power History Chart Placeholder" 
              width={500} 
              height={250}
              data-ai-hint="power history"
              className="rounded-md"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
