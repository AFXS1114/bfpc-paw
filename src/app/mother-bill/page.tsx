
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, DocumentData, where } from "firebase/firestore";
import { Save, Loader2, ListChecks, Edit, Zap } from "lucide-react";
import type { MotherBillEntry, MotherBillDocument } from "@/types";
import { format } from "date-fns";

const motherBillFormSchema = z.object({
  billingMonth: z.string().min(1, "Billing month is required."),
  billingYear: z.coerce.number().min(2000, "Invalid year.").max(new Date().getFullYear() + 5, "Invalid year."),
  pastReading: z.coerce.number().min(0, "Past reading must be non-negative."),
  presentReading: z.coerce.number().min(0, "Present reading must be non-negative."),
  totalConsumption: z.coerce.number().min(0, "Total consumption must be non-negative."),
  totalAmountBilled: z.coerce.number().min(0, "Total amount must be non-negative."),
  notes: z.string().optional(),
}).refine(data => data.presentReading >= data.pastReading, {
  message: "Present reading must be greater than or equal to past reading.",
  path: ["presentReading"],
});

type MotherBillFormData = z.infer<typeof motherBillFormSchema>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const UTILITY_TYPE = 'power';
const CONSUMPTION_UNIT = 'kWh';
const UTILITY_ICON = <Zap className="h-5 w-5 mr-2 text-primary" />;
const PAGE_TITLE = "Power Mother Bill Entry & Records";
const FORM_TITLE = "Enter Main Power Utility Bill Details";
const FORM_DESCRIPTION = "Input the details from your primary power bill.";
const SAVE_BUTTON_TEXT = "Save Power Mother Bill";
const RECORDS_TITLE = "Power Mother Bill Records";
const RECORDS_DESCRIPTION = "List of all saved power mother bill entries.";
const NO_RECORDS_TEXT = "No power mother bill records found.";


export default function PowerMotherBillPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [motherBills, setMotherBills] = useState<MotherBillDocument[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);

  const form = useForm<MotherBillFormData>({
    resolver: zodResolver(motherBillFormSchema),
    defaultValues: {
      billingMonth: MONTHS[new Date().getMonth()],
      billingYear: new Date().getFullYear(),
      pastReading: 0,
      presentReading: 0,
      totalConsumption: 0,
      totalAmountBilled: 0,
      notes: "",
    },
  });

  const { reset } = form;

  useEffect(() => {
    setIsLoadingRecords(true);
    const recordsQuery = query(
      collection(db, "mother-bills"), 
      where("utilityType", "==", UTILITY_TYPE),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(recordsQuery, (querySnapshot) => {
      const recordsData = querySnapshot.docs.map(doc => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate(), 
        } as MotherBillDocument;
      });
      setMotherBills(recordsData);
      setIsLoadingRecords(false);
    }, (error) => {
      console.error(`Error fetching ${UTILITY_TYPE} mother bills: `, error);
      toast({
        title: "Error",
        description: `Failed to fetch ${UTILITY_TYPE} mother bill records.`,
        variant: "destructive",
      });
      setIsLoadingRecords(false);
    });

    return () => unsubscribe();
  }, [toast]);

  async function onSubmit(data: MotherBillFormData) {
    setIsSubmitting(true);
    try {
      const motherBillData: Omit<MotherBillEntry, 'id' | 'createdAt'> & { createdAt: any } = {
        utilityType: UTILITY_TYPE,
        billingMonth: data.billingMonth,
        billingYear: data.billingYear,
        pastReading: data.pastReading,
        presentReading: data.presentReading,
        totalConsumption: data.totalConsumption, // Use the directly entered total consumption
        totalAmountBilled: data.totalAmountBilled,
        notes: data.notes || "",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "mother-bills"), motherBillData);

      toast({
        title: `${UTILITY_TYPE.charAt(0).toUpperCase() + UTILITY_TYPE.slice(1)} Mother Bill Saved`,
        description: `Mother bill for ${data.billingMonth} ${data.billingYear} has been saved successfully.`,
      });
      reset({
        billingMonth: MONTHS[new Date().getMonth()],
        billingYear: new Date().getFullYear(),
        pastReading: 0,
        presentReading: 0,
        totalConsumption: 0,
        totalAmountBilled: 0,
        notes: "",
      });
    } catch (error) {
      console.error("Error saving mother bill: ", error);
      toast({
        title: "Error",
        description: "Failed to save mother bill. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const handleEditRecord = (recordId: string) => {
    toast({ title: "Edit Clicked", description: `Would edit ${UTILITY_TYPE} mother bill record: ${recordId}` });
  };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={PAGE_TITLE} />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {UTILITY_ICON}
              {FORM_TITLE}
            </CardTitle>
            <CardDescription>
              {FORM_DESCRIPTION}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-md">
                  <legend className="text-sm font-medium px-1">Billing Period</legend>
                  <FormField
                    control={form.control}
                    name="billingMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Month</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={MONTHS[new Date().getMonth()]}>
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
                    name="pastReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Past Reading ({CONSUMPTION_UNIT})</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 15000" {...field} />
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
                        <FormLabel>Present Reading ({CONSUMPTION_UNIT})</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 16500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalConsumption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Consumption ({CONSUMPTION_UNIT})</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 1500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="totalAmountBilled"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount Billed (₱)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 500.75" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder={`Any relevant notes about this ${UTILITY_TYPE} mother bill...`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {SAVE_BUTTON_TEXT}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-6 w-6 text-primary" />
              {RECORDS_TITLE}
            </CardTitle>
            <CardDescription>
              {RECORDS_DESCRIPTION}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRecords ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : motherBills.length === 0 ? (
              <p className="text-muted-foreground text-center">{NO_RECORDS_TEXT}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Billing Period</TableHead>
                    <TableHead className="text-right">Past ({CONSUMPTION_UNIT})</TableHead>
                    <TableHead className="text-right">Present ({CONSUMPTION_UNIT})</TableHead>
                    <TableHead className="text-right">Total ({CONSUMPTION_UNIT})</TableHead>
                    <TableHead className="text-right">Amount (₱)</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Recorded On</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {motherBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell>{bill.billingMonth} {bill.billingYear}</TableCell>
                      <TableCell className="text-right">{bill.pastReading.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{bill.presentReading.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">{bill.totalConsumption.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {bill.totalAmountBilled.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={bill.notes}>{bill.notes || "-"}</TableCell>
                      <TableCell>{bill.createdAt ? format(new Date(bill.createdAt), "MMM dd, yyyy") : 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => bill.id && handleEditRecord(bill.id)}
                          disabled={!bill.id}
                        >
                          <Edit className="mr-1 h-3 w-3" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
