
"use client";

import { useState, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ReceiptText, Save, Loader2, FileText } from "lucide-react";
import type { MotherBillEntry } from "@/types";

const motherBillFormSchema = z.object({
  billingMonth: z.string().min(1, "Billing month is required."),
  billingYear: z.coerce.number().min(2000, "Invalid year.").max(new Date().getFullYear() + 5, "Invalid year."),
  pastReading: z.coerce.number().min(0, "Past reading must be non-negative."),
  presentReading: z.coerce.number().min(0, "Present reading must be non-negative."),
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

export default function MotherBillPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MotherBillFormData>({
    resolver: zodResolver(motherBillFormSchema),
    defaultValues: {
      billingMonth: MONTHS[new Date().getMonth()],
      billingYear: new Date().getFullYear(),
      pastReading: 0,
      presentReading: 0,
      totalAmountBilled: 0,
      notes: "",
    },
  });

  const { watch } = form;
  const pastReading = watch("pastReading");
  const presentReading = watch("presentReading");

  const totalKwh = useMemo(() => {
    const past = Number(pastReading);
    const present = Number(presentReading);
    if (!isNaN(past) && !isNaN(present) && present >= past) {
      return present - past;
    }
    return 0;
  }, [pastReading, presentReading]);

  async function onSubmit(data: MotherBillFormData) {
    setIsSubmitting(true);
    try {
      const motherBillData: Omit<MotherBillEntry, 'id' | 'createdAt' | 'totalKwh'> & { totalKwh: number; createdAt: any } = {
        billingMonth: data.billingMonth,
        billingYear: data.billingYear,
        pastReading: data.pastReading,
        presentReading: data.presentReading,
        totalKwh: totalKwh, // Calculated value
        totalAmountBilled: data.totalAmountBilled,
        notes: data.notes || "",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "mother-bills"), motherBillData);

      toast({
        title: "Mother Bill Saved",
        description: `Mother bill for ${data.billingMonth} ${data.billingYear} has been saved successfully.`,
      });
      form.reset({
        billingMonth: MONTHS[new Date().getMonth()],
        billingYear: new Date().getFullYear(),
        pastReading: 0,
        presentReading: 0,
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

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Mother Bill Entry" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Enter Main Utility Bill Details
            </CardTitle>
            <CardDescription>
              Input the details from your primary electricity bill (mother bill).
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
                    name="pastReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Past Reading (kWh)</FormLabel>
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
                        <FormLabel>Present Reading (kWh)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 16500" {...field} />
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
                  name="totalAmountBilled"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount Billed ($)</FormLabel>
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
                        <Textarea placeholder="Any relevant notes about this mother bill..." {...field} />
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
                  Save Mother Bill
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
