
"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
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
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import type { MotherBillDocument } from "@/types";
import { Loader2, Save, Zap, Droplet } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const editMotherBillFormSchema = z.object({
  billingMonth: z.string().min(1, "Billing month is required."),
  billingYear: z.coerce.number().min(2000, "Invalid year.").max(2099, "Invalid year."),
  pastReading: z.coerce.number().min(0, "Past reading must be non-negative."),
  presentReading: z.coerce.number().min(0, "Present reading must be non-negative."),
  totalConsumption: z.coerce.number().min(0, "Total consumption must be non-negative."),
  totalAmountBilled: z.coerce.number().min(0, "Total amount must be non-negative."),
  notes: z.string().optional(),
}).refine(data => data.presentReading >= data.pastReading, {
  message: "Present reading must be greater than or equal to past reading.",
  path: ["presentReading"],
});

type EditMotherBillFormData = z.infer<typeof editMotherBillFormSchema>;

interface EditMotherBillModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bill: MotherBillDocument | null;
  utilityType: 'power' | 'water';
}

export function EditMotherBillModal({ isOpen, onOpenChange, bill, utilityType }: EditMotherBillModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditMotherBillFormData>({
    resolver: zodResolver(editMotherBillFormSchema),
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
  
  const { reset, watch, setValue } = form;
  
  const pastReadingValue = watch("pastReading");
  const presentReadingValue = watch("presentReading");
  
  // Conditionally calculate total consumption for water
  useEffect(() => {
    if (utilityType === 'water') {
      const past = Number(pastReadingValue);
      const present = Number(presentReadingValue);
      if (!isNaN(past) && !isNaN(present) && present >= past) {
        setValue("totalConsumption", present - past, { shouldValidate: true });
      } else {
        setValue("totalConsumption", 0);
      }
    }
  }, [pastReadingValue, presentReadingValue, utilityType, setValue]);

  useEffect(() => {
    if (bill && isOpen) {
      reset({
        billingMonth: bill.billingMonth,
        billingYear: bill.billingYear,
        pastReading: bill.pastReading,
        presentReading: bill.presentReading,
        totalConsumption: bill.totalConsumption,
        totalAmountBilled: bill.totalAmountBilled,
        notes: bill.notes || "",
      });
    }
  }, [bill, isOpen, reset]);
  
  const utilityConfig = useMemo(() => {
    if (utilityType === 'power') {
      return {
        unit: 'kWh',
        icon: <Zap className="h-5 w-5 mr-2 text-primary" />,
        title: 'Edit Power Mother Bill',
        description: 'Modify the details for the power mother bill.',
      };
    }
    return {
      unit: 'm³',
      icon: <Droplet className="h-5 w-5 mr-2 text-primary" />,
      title: 'Edit Water Mother Bill',
      description: 'Modify the details for the water mother bill.',
    };
  }, [utilityType]);

  async function onSubmit(data: EditMotherBillFormData) {
    if (!bill || !bill.id) {
      toast({ title: "Error", description: "No bill selected for editing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const billRef = doc(db, "mother-bills", bill.id);
      const updatedBillData = {
        utilityType: bill.utilityType,
        billingMonth: data.billingMonth,
        billingYear: data.billingYear,
        pastReading: data.pastReading,
        presentReading: data.presentReading,
        totalConsumption: data.totalConsumption,
        totalAmountBilled: data.totalAmountBilled,
        notes: data.notes || "",
      };

      await updateDoc(billRef, updatedBillData);
      
      toast({
        title: "Mother Bill Updated",
        description: `${utilityType.charAt(0).toUpperCase() + utilityType.slice(1)} mother bill for ${data.billingMonth} ${data.billingYear} has been updated.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating mother bill: ", error);
      toast({
        title: "Update Failed",
        description: "Failed to update mother bill. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!bill) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {utilityConfig.icon} {utilityConfig.title}
          </DialogTitle>
          <DialogDescription>
            {utilityConfig.description}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">Billing Period</legend>
                 <FormField
                    control={form.control}
                    name="billingMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Month</FormLabel>
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
                        <FormLabel>Past Reading ({utilityConfig.unit})</FormLabel>
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
                        <FormLabel>Present Reading ({utilityConfig.unit})</FormLabel>
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
                        <FormLabel>Total Consumption ({utilityConfig.unit})</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 1500" {...field} readOnly={utilityType === 'water'} className={utilityType === 'water' ? 'bg-muted/80' : ''}/>
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
                    <FormItem className="max-w-md">
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
                <FormItem className="max-w-lg">
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
