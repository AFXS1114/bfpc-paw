
"use client";

import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { ReadingPerformerEntry } from "@/types";
import { Loader2, UserCog, Save } from "lucide-react"; // Changed icon

const readingPerformerFormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  position: z.string().min(1, "Position is required."),
});

type ReadingPerformerFormData = z.infer<typeof readingPerformerFormSchema>;

interface AddReadingPerformerModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AddReadingPerformerModal({ isOpen, onOpenChange }: AddReadingPerformerModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReadingPerformerFormData>({
    resolver: zodResolver(readingPerformerFormSchema),
    defaultValues: {
      name: "",
      position: "",
    },
  });

  async function onSubmit(data: ReadingPerformerFormData) {
    setIsSubmitting(true);
    try {
      const readingPerformerData: Omit<ReadingPerformerEntry, "id" | "createdAt"> & { createdAt: any } = {
        name: data.name,
        position: data.position,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "reading-performers"), readingPerformerData);

      toast({
        title: "Reading Performer Added",
        description: `Reading Performer ${data.name} has been added successfully.`,
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding reading performer: ", error);
      toast({
        title: "Error",
        description: "Failed to add reading performer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Reading Performer</DialogTitle>
          <DialogDescription>
            Enter the name and position of the person who performs the meter readings.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Mark Readingson" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Meter Reader" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Reading Performer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
