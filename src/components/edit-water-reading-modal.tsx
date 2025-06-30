
"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar as CalendarIcon, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, updateDoc, Timestamp, serverTimestamp } from "firebase/firestore";
import type { WaterReadingDocument } from "@/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const editWaterReadingFormSchema = z.object({
  dateBilled: z.date({ required_error: "Date billed is required." }),
  billingMonth: z.string().min(1, "Billing month is required."),
  billingYear: z.coerce.number().min(2000, "Invalid year.").max(2099, "Invalid year."),
  previousReading: z.coerce.number().min(0, "Previous reading must be non-negative."),
  presentReading: z.coerce.number().min(0, "Present reading must be non-negative."),
  notes: z.string().optional(),
}).refine(data => data.presentReading >= data.previousReading, {
  message: "Present reading must be greater than or equal to previous reading.",
  path: ["presentReading"],
});

type EditWaterReadingFormData = z.infer<typeof editWaterReadingFormSchema>;

interface EditWaterReadingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  reading: WaterReadingDocument | null;
}

export function EditWaterReadingModal({ isOpen, onOpenChange, reading }: EditWaterReadingModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditWaterReadingFormData>({
    resolver: zodResolver(editWaterReadingFormSchema),
    defaultValues: {
      dateBilled: new Date(),
      billingMonth: MONTHS[new Date().getMonth()],
      billingYear: new Date().getFullYear(),
      previousReading: 0,
      presentReading: 0,
      notes: "",
    },
  });

  const { watch, reset } = form;
  const previousReadingValue = watch("previousReading");
  const presentReadingValue = watch("presentReading");

  const totalM3 = useMemo(() => {
    const prev = Number(previousReadingValue);
    const pres = Number(presentReadingValue);
    if (!isNaN(prev) && !isNaN(pres) && pres >= prev) {
      return pres - prev;
    }
    return 0;
  }, [previousReadingValue, presentReadingValue]);

  useEffect(() => {
    if (reading && isOpen) {
      reset({
        dateBilled: reading.dateBilled ? new Date(reading.dateBilled) : new Date(),
        billingMonth: reading.billingMonth,
        billingYear: reading.billingYear,
        previousReading: reading.previousReading,
        presentReading: reading.presentReading,
        notes: reading.notes || "",
      });
    }
  }, [reading, isOpen, reset]);

  async function onSubmit(data: EditWaterReadingFormData) {
    if (!reading || !reading.id) {
      toast({ title: "Error", description: "No reading selected for editing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const readingRef = doc(db, "water-readings", reading.id);
      const updatedWaterReadingData = {
        clientId: reading.clientId,
        clientName: reading.clientName,
        stallNo: reading.stallNo,
        waterMeterNo: reading.waterMeterNo,
        dateBilled: Timestamp.fromDate(data.dateBilled),
        billingMonth: data.billingMonth,
        billingYear: data.billingYear,
        previousReading: data.previousReading,
        presentReading: data.presentReading,
        totalM3: Number(data.presentReading) - Number(data.previousReading),
        notes: data.notes || "",
        createdAt: reading.createdAt ? Timestamp.fromDate(new Date(reading.createdAt)) : serverTimestamp(),
      };
      
      const updatePayload: { [key: string]: any } = {};
      for (const key in updatedWaterReadingData) {
        if (updatedWaterReadingData[key as keyof typeof updatedWaterReadingData] !== undefined) {
          updatePayload[key] = updatedWaterReadingData[key as keyof typeof updatedWaterReadingData];
        }
      }

      await updateDoc(readingRef, updatePayload);
      
      toast({
        title: "Reading Updated",
        description: `Water reading for ${reading.clientName} (${reading.billingMonth} ${reading.billingYear}) updated.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating water reading: ", error);
      toast({
        title: "Update Failed",
        description: "Failed to update water reading. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!reading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Water Reading</DialogTitle>
          <DialogDescription>
            Modify the details for client: <strong>{reading.clientName} ({reading.stallNo})</strong>.
            Water Meter No: <strong>{reading.waterMeterNo}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="billingMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Month</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MONTHS.map((month) => (
                          <SelectItem key={month} value={month}>{month}</SelectItem>
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
                    <FormLabel>Billing Year</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="YYYY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="previousReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous (m³)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
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
                    <FormLabel>Present (m³)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Total (m³)</FormLabel>
                <Input type="number" value={totalM3} readOnly className="bg-muted/80 font-semibold" />
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any relevant notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
