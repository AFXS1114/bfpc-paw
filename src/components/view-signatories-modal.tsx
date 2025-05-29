
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
import type { SignatoryDocument } from "@/types";
import { format } from "date-fns";

interface ViewSignatoriesModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ViewSignatoriesModal({ isOpen, onOpenChange }: ViewSignatoriesModalProps) {
  const { toast } = useToast();
  const [signatories, setSignatories] = useState<SignatoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSignatories([]); 
      return;
    }

    setIsLoading(true);
    const signatoriesQuery = query(collection(db, "signatories"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(signatoriesQuery, (querySnapshot) => {
      const signatoriesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(),
        } as SignatoryDocument;
      });
      setSignatories(signatoriesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching signatories: ", error);
      toast({
        title: "Error",
        description: "Failed to fetch signatories.",
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
          <DialogTitle>View Invoice Signatories</DialogTitle>
          <DialogDescription>
            List of all saved invoice signatories.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] py-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : signatories.length === 0 ? (
            <p className="text-center text-muted-foreground">No signatories found.</p>
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
                {signatories.map((signatory) => (
                  <TableRow key={signatory.id}>
                    <TableCell className="font-medium">{signatory.name}</TableCell>
                    <TableCell>{signatory.position}</TableCell>
                    <TableCell>
                      {signatory.createdAt ? format(new Date(signatory.createdAt), "MMM dd, yyyy, hh:mm a") : 'N/A'}
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
