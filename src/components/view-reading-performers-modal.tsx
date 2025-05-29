
"use client";

import { useState, useEffect } from "react";
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import type { ReadingPerformerDocument } from "@/types";
import { format } from "date-fns";

interface ViewReadingPerformersModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ViewReadingPerformersModal({ isOpen, onOpenChange }: ViewReadingPerformersModalProps) {
  const { toast } = useToast();
  const [performers, setPerformers] = useState<ReadingPerformerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPerformers([]); 
      return;
    }

    setIsLoading(true);
    const performersQuery = query(collection(db, "reading-performers"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(performersQuery, (querySnapshot) => {
      const performersData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(),
        } as ReadingPerformerDocument;
      });
      setPerformers(performersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching reading performers: ", error);
      toast({
        title: "Error",
        description: "Failed to fetch reading performers.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>View Reading Performers</DialogTitle>
          <DialogDescription>
            List of all saved reading performers.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] py-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : performers.length === 0 ? (
            <p className="text-center text-muted-foreground">No reading performers found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Added On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performers.map((performer) => (
                  <TableRow key={performer.id}>
                    <TableCell className="font-medium">{performer.name}</TableCell>
                    <TableCell>{performer.position}</TableCell>
                    <TableCell>
                      {performer.createdAt ? format(new Date(performer.createdAt), "MMM dd, yyyy, hh:mm a") : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
