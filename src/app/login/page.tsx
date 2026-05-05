"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

const passcodeSchema = z.object({
  passcode: z.string().min(1, "Passcode is required."),
});

type PasscodeFormData = z.infer<typeof passcodeSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const passcodeForm = useForm<PasscodeFormData>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: { passcode: "" },
  });

  const handlePasscodeSubmit = (data: PasscodeFormData) => {
    setIsLoading(true);
    if (data.passcode === "BFPC2017") {
      localStorage.setItem("pawUserVerified", "true");
      localStorage.setItem("pawUserRole", "system-admin");
      localStorage.setItem("pawUserId", "admin-fixed");
      localStorage.setItem("pawUserName", "Administrator");
      toast({ title: "Success", description: "You are now logged in." });
      router.push("/"); 
    } else {
      toast({ title: "Invalid Passcode", variant: "destructive" });
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
            Enter the passcode to access the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                        type="password"
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
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify Passcode
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} PAW App</p>
        </CardFooter>
      </Card>
    </div>
  );
}
