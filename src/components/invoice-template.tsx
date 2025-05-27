
"use client";

import type { InvoiceData } from "@/types";
import { format } from "date-fns";
import Image from "next/image";

interface InvoiceTemplateProps {
  data: InvoiceData;
}

export function InvoiceTemplate({ data }: InvoiceTemplateProps) {
  // Helper to format currency
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div id="invoice-to-export" className="p-8 bg-background text-foreground font-sans text-sm max-w-4xl mx-auto border rounded-lg shadow-lg">
      {/* Header */}
      <header className="flex justify-between items-start pb-6 border-b mb-6">
        <div>
          {data.companyLogoUrl && (
            <Image 
              src={data.companyLogoUrl} 
              alt={`${data.companyName} Logo`} 
              width={120} 
              height={60} 
              className="mb-2"
              data-ai-hint="company logo"
            />
          )}
          <h1 className="text-2xl font-bold text-primary">{data.companyName}</h1>
          <p>{data.companyAddressLine1}</p>
          <p>{data.companyAddressLine2}</p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-semibold text-primary/90 mb-1">INVOICE</h2>
          <p className="text-base">
            <span className="font-medium">Invoice #:</span> {data.invoiceNumber}
          </p>
          <p>
            <span className="font-medium">Date:</span> {data.invoiceDate}
          </p>
          {data.dueDate && (
            <p>
              <span className="font-medium">Due Date:</span> {data.dueDate}
            </p>
          )}
        </div>
      </header>

      {/* Client Information */}
      <section className="mb-8 grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold text-primary mb-1">Bill To:</h3>
          <p className="font-medium">{data.clientName}</p>
          <p>Stall No: {data.stallNo}</p>
        </div>
        <div className="text-right">
           <h3 className="font-semibold text-primary mb-1">Billing Period:</h3>
           <p>{data.billingMonth} {data.billingYear}</p>
        </div>
      </section>

      {/* Line Items Table */}
      <section className="mb-8">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="p-2 border font-medium">Description</th>
              <th className="p-2 border font-medium text-right">Previous Reading (kWh)</th>
              <th className="p-2 border font-medium text-right">Present Reading (kWh)</th>
              <th className="p-2 border font-medium text-right">Consumption (kWh)</th>
              <th className="p-2 border font-medium text-right">Rate ($/kWh)</th>
              <th className="p-2 border font-medium text-right">Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border">Power Consumption</td>
              <td className="p-2 border text-right">{data.clientPreviousReading.toLocaleString()}</td>
              <td className="p-2 border text-right">{data.clientPresentReading.toLocaleString()}</td>
              <td className="p-2 border text-right font-medium">{data.clientTotalKwh.toLocaleString()}</td>
              <td className="p-2 border text-right">{data.basicRate.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
              <td className="p-2 border text-right">{formatCurrency(data.clientTotalKwh * data.basicRate)}</td>
            </tr>
          </tbody>
        </table>
      </section>
      
      {/* Mother Bill Reference (Optional for display, good for transparency) */}
      <section className="mb-8 p-3 bg-muted/30 rounded-md text-xs">
        <h4 className="font-semibold mb-1 text-primary/80">Rate Calculation Basis (Mother Bill {data.billingMonth} {data.billingYear}):</h4>
        <div className="grid grid-cols-2 gap-x-4">
            <p>Total Mother Bill Amount: ${formatCurrency(data.motherBillTotalAmount)}</p>
            <p>Total Mother Bill Consumption: {data.motherBillTotalConsumption.toLocaleString()} kWh</p>
        </div>
      </section>


      {/* Summary */}
      <section className="flex justify-end mb-8">
        <div className="w-full md:w-1/2 lg:w-1/3 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${formatCurrency(data.amountBeforeVAT)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (12%):</span>
            <span>${formatCurrency(data.vatAmount)}</span>
          </div>
          <hr className="my-1 border-border"/>
          <div className="flex justify-between font-bold text-lg text-primary">
            <span>Total Amount Due:</span>
            <span>${formatCurrency(data.totalAmountDue)}</span>
          </div>
        </div>
      </section>

      {/* Footer / Payment Instructions */}
      {data.paymentInstructions && (
        <footer className="pt-6 border-t">
          <h3 className="font-semibold text-primary mb-1">Payment Instructions:</h3>
          <p className="text-sm whitespace-pre-line">{data.paymentInstructions}</p>
        </footer>
      )}
       <div className="mt-8 text-center text-xs text-muted-foreground">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );
}
