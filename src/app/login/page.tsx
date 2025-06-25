"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import emailjs from "emailjs-com";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Label is not directly used in this file, but good to keep for consistency
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, updateDoc } from "firebase/firestore";
import type { AppUserDocument } from "@/types";
import { Mail, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

const emailSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
});

const passcodeSchema = z.object({
  passcode: z.string().min(1, "Passcode is required."),
});

type EmailFormData = z.infer<typeof emailSchema>;
type PasscodeFormData = z.infer<typeof passcodeSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "passcode">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUser, setIsFetchingUser] = useState(false); // For direct passcode entry user fetch
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [storedUser, setStoredUser] = useState<AppUserDocument | null>(null);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const passcodeForm = useForm<PasscodeFormData>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: { passcode: "" },
  });

  const fetchUserByEmail = async (email: string): Promise<AppUserDocument | null> => {
    const usersRef = collection(db, "app-users");
    const q = query(usersRef, where("email", "==", email), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      toast({
        title: "Email Not Found",
        description: "The provided email address is not registered.",
        variant: "destructive",
      });
      return null;
    }
    const userDocData = querySnapshot.docs[0].data() as Omit<AppUserDocument, 'id'>;
    return { id: querySnapshot.docs[0].id, ...userDocData } as AppUserDocument;
  };


  const handleEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    const trimmedEmail = data.email.trim();

    if (!trimmedEmail) {
      toast({
        title: "Invalid Email",
        description: "Email address cannot be empty or just whitespace.",
        variant: "destructive",
      });
      setIsLoading(false);
      emailForm.setValue("email", ""); 
      return;
    }
    
    setSubmittedEmail(trimmedEmail);

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

    try {
      const userDoc = await fetchUserByEmail(trimmedEmail);
      if (!userDoc) {
        setIsLoading(false);
        return;
      }
      setStoredUser(userDoc);

      if (!serviceId || typeof serviceId !== 'string') {
        console.error("EmailJS Service ID is not configured or not a string.");
        toast({ title: "Configuration Error", description: "Email sending service ID is missing. Check .env.local.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (!templateId || typeof templateId !== 'string') {
        console.error("EmailJS Template ID is not configured or not a string. Value:", process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID);
        toast({ title: "Configuration Error", description: `Email sending template ID (currently: ${process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'NOT_SET'}) is missing or invalid. Check .env.local.`, variant: "destructive", duration: 9000 });
        setIsLoading(false);
        return;
      }
      if (!publicKey || typeof publicKey !== 'string') {
        console.error("EmailJS Public Key is not configured or not a string.");
        toast({ title: "Configuration Error", description: "Email sending public key is missing. Check .env.local.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (!userDoc.name || typeof userDoc.name !== 'string') {
        console.error("User name is missing or not a string for template params.", userDoc);
        toast({ title: "Data Error", description: "User data (name) is incomplete for sending email.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (!userDoc.passcode || typeof userDoc.passcode !== 'string') {
        console.error("User passcode is missing or not a string for template params.", userDoc);
        toast({ title: "Data Error", description: "User data (passcode) is incomplete for sending email.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const templateParams = {
        to_email: trimmedEmail,
        user_name: userDoc.name,
        passcode: userDoc.passcode,
      };
      
      console.log("Sending email with params:", templateParams);
      await emailjs.send(serviceId, templateId, templateParams, publicKey);

      toast({
        title: "Passcode Sent",
        description: "A passcode has been sent to your email address.",
      });
      setStep("passcode");
    } catch (error: any) {
      console.error("Error during email submission or sending email: ", error);
      const currentTemplateIdValue = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      let errorMessage = "An error occurred while trying to send the passcode email. Please try again.";
      
      if (error && typeof error === 'object') {
        if ('status' in error && 'text' in error) {
           if (error.status === 422 && error.text === "The recipients address is empty") {
            errorMessage = `Failed to send email: EmailJS reports "The recipients address is empty". This likely means the 'To Email' field in your EmailJS template (ID: ${currentTemplateIdValue || 'NOT_FOUND'}) on the EmailJS website is not correctly set to use '{{to_email}}'. Please verify your EmailJS template settings.`;
          } else {
            errorMessage = `Failed to send passcode email. Server responded with: ${error.text} (Status: ${error.status})`;
          }
        } else if (Object.keys(error).length === 0) { 
           errorMessage = `Failed to send passcode email. Received an empty error response. This might be due to incorrect EmailJS service/template IDs (Template ID: ${currentTemplateIdValue || 'NOT_FOUND'}), user parameters, or network issues. Please verify your EmailJS setup and template variables.`;
        } else {
          try {
            const errorString = JSON.stringify(error);
            errorMessage = `Failed to send passcode email. Unexpected error: ${errorString}. Please contact support.`;
          } catch (e) {
            errorMessage = "Failed to send passcode email. An unknown and unstringifiable error occurred. Please contact support.";
          }
        }
      } else if (error instanceof Error) { 
        errorMessage = `Failed to send passcode email: ${error.message}. Please contact support.`;
      }
      
      toast({
        title: "Error Sending Email",
        description: errorMessage,
        variant: "destructive",
        duration: 12000, 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectPasscodeEntry = async () => {
    const emailIsValid = await emailForm.trigger("email");
    if (!emailIsValid) {
      emailForm.setFocus("email");
      return;
    }
    
    const emailValue = emailForm.getValues("email").trim();
    if (!emailValue) {
        toast({ title: "Email Required", description: "Please enter your email address first.", variant: "destructive"});
        return;
    }

    setIsFetchingUser(true);
    setSubmittedEmail(emailValue);
    try {
        const user = await fetchUserByEmail(emailValue);
        if (user) {
            setStoredUser(user);
            setStep("passcode");
        }
    } catch (error) {
        console.error("Error fetching user for direct passcode entry:", error);
        toast({ title: "Error", description: "Could not fetch user details. Please try again.", variant: "destructive"});
    } finally {
        setIsFetchingUser(false);
    }
  };


  const handlePasscodeSubmit = (data: PasscodeFormData) => {
    setIsLoading(true);
    if (storedUser && data.passcode === storedUser.passcode) {
      localStorage.setItem("pawUserVerified", "true");
      localStorage.setItem("pawUserRole", storedUser.role);
      localStorage.setItem("pawUserId", storedUser.id);
      localStorage.setItem("pawUserName", storedUser.name);
      toast({
        title: "Verification Successful",
        description: "You are now logged in.",
      });
      router.push("/"); 
    } else {
      toast({
        title: "Invalid Passcode",
        description: "The entered passcode is incorrect. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="items-center text-center">
          <AppLogo className="mb-4" />
          <CardTitle className="text-2xl">Power &amp; Water</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your email to receive a passcode."
              : `Enter the passcode sent to ${submittedEmail}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <Form {...emailForm}>
              <form
                onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          className="text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading || isFetchingUser}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Send Passcode
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm text-muted-foreground hover:text-primary p-0 h-auto"
                  onClick={handleDirectPasscodeEntry}
                  disabled={isLoading || isFetchingUser}
                >
                   {isFetchingUser ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : null}
                  Already have a passcode? Enter it directly.
                </Button>
              </form>
            </Form>
          )}

          {step === "passcode" && (
            <Form {...passcodeForm}>
              <form
                onSubmit={passcodeForm.handleSubmit(handlePasscodeSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={passcodeForm.control}
                  name="passcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                        Passcode
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter passcode"
                          {...field}
                          className="text-base tracking-wider"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                     <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Verify Passcode
                </Button>
                <Button
                  variant="link"
                  className="w-full"
                  onClick={() => {
                    setStep("email");
                    passcodeForm.reset();
                    // Do not clear storedUser or submittedEmail here, as they might be needed if user toggles back
                  }}
                  disabled={isLoading}
                >
                  Back to email input
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="justify-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} PAW App. All rights reserved.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
    
