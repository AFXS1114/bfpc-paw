
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
    return amount.toLocaleString('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const companyLogoPath = data.companyLogoUrl || "/company-logo.png"; 

  const renderInvoiceContent = (copyIdentifier?: string) => (
    <div className="p-8 bg-white text-neutral-900 font-sans text-sm max-w-[794px] mx-auto border border-neutral-300 rounded-lg shadow-lg mb-6 break-inside-avoid">
      {/* Header */}
      <header className="flex justify-between items-start pb-6 border-b border-neutral-300 mb-6">
        <div>
          <Image 
            src={companyLogoPath} 
            alt={`${data.companyName || 'Company'} Logo`}
            width={120} 
            height={60} 
            className="mb-2 object-contain"
            data-ai-hint="company logo"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/120x60.png?text=No+Logo'; }}
          />
          <h1 className="text-2xl font-bold text-blue-700">{data.companyName}</h1>
          <p className="text-neutral-700">{data.companyAddressLine1}</p>
          {data.companyAddressLine2 && <p className="text-neutral-700">{data.companyAddressLine2}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-semibold text-blue-600 mb-1">INVOICE {copyIdentifier && <span className="text-xs block normal-case">({copyIdentifier})</span>}</h2>
          <p className="text-base text-neutral-800">
            <span className="font-medium">Invoice #:</span> {data.invoiceNumber}
          </p>
          <p className="text-neutral-800">
            <span className="font-medium">Date:</span> {data.invoiceDate}
          </p>
        </div>
      </header>

      {/* Client Information */}
      <section className="mb-8 grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold text-blue-700 mb-1">Bill To:</h3>
          <p className="font-medium text-neutral-800">{data.clientName}</p>
          <p className="text-neutral-700">Stall No: {data.stallNo}</p>
        </div>
        <div className="text-right">
           <h3 className="font-semibold text-blue-700 mb-1">Billing Period:</h3>
           <p className="text-neutral-700">{data.billingMonth} {data.billingYear}</p>
        </div>
      </section>

      {/* Line Items Table */}
      <section className="mb-8">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-100 text-left text-neutral-800">
              <th className="p-2 border border-neutral-300 font-medium">Description</th>
              <th className="p-2 border border-neutral-300 font-medium text-right">Previous Reading (kWh)</th>
              <th className="p-2 border border-neutral-300 font-medium text-right">Present Reading (kWh)</th>
              <th className="p-2 border border-neutral-300 font-medium text-right">Consumption (kWh)</th>
              <th className="p-2 border border-neutral-300 font-medium text-right">Rate (₱/kWh)</th>
              <th className="p-2 border border-neutral-300 font-medium text-right">Amount (₱)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-neutral-700">
              <td className="p-2 border border-neutral-300">Power Consumption</td>
              <td className="p-2 border border-neutral-300 text-right">{data.clientPreviousReading.toLocaleString()}</td>
              <td className="p-2 border border-neutral-300 text-right">{data.clientPresentReading.toLocaleString()}</td>
              <td className="p-2 border border-neutral-300 text-right font-medium">{data.clientTotalKwh.toLocaleString()}</td>
              <td className="p-2 border border-neutral-300 text-right">₱{data.basicRate.toFixed(4)}</td>
              <td className="p-2 border border-neutral-300 text-right">{formatCurrency(data.clientTotalKwh * data.basicRate)}</td>
            </tr>
          </tbody>
        </table>
      </section>
      
      <section className="mb-8 p-3 bg-neutral-50 rounded-md text-xs text-neutral-700">
        <h4 className="font-semibold mb-1 text-blue-600">Rate Calculation Basis (Mother Bill {data.billingMonth} {data.billingYear}):</h4>
        <div className="grid grid-cols-2 gap-x-4">
            <p>Total Mother Bill Amount: {formatCurrency(data.motherBillTotalAmount)}</p>
            <p>Total Mother Bill Consumption: {data.motherBillTotalConsumption.toLocaleString()} kWh</p>
        </div>
      </section>

      <section className="flex justify-end mb-8 text-neutral-800">
        <div className="w-full md:w-1/2 lg:w-1/3 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(data.amountBeforeVAT)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (12%):</span>
            <span>{formatCurrency(data.vatAmount)}</span>
          </div>
          <hr className="my-1 border-neutral-300"/>
          <div className="flex justify-between font-bold text-lg text-blue-700">
            <span>Total Amount Due:</span>
            <span>{formatCurrency(data.totalAmountDue)}</span>
          </div>
        </div>
      </section>

      {data.paymentInstructions && (
        <footer className="pt-6 border-t border-neutral-300 text-neutral-700">
          <h3 className="font-semibold text-blue-700 mb-1">Payment Instructions:</h3>
          <p className="text-sm whitespace-pre-line">{data.paymentInstructions}</p>
        </footer>
      )}

      {/* Personnel Section */}
      <div className="mt-12 pt-8 border-t border-neutral-300">
        <div className="grid grid-cols-2 gap-8">
          {(data.readingPerformerName || data.readingPerformerPosition) && (
            <div>
              <p className="mb-1 text-sm font-medium text-neutral-700">Readings Performed by:</p>
              <div className="mt-10 mb-1 border-b border-neutral-500 h-4"></div> {/* Signature line */}
              <p className="mt-1 text-sm font-semibold text-neutral-800">{data.readingPerformerName || "_________________________"}</p>
              <p className="text-xs text-neutral-600">{data.readingPerformerPosition || "Position"}</p>
            </div>
          )}
           {(data.signatoryName || data.signatoryPosition) && (
            <div className={(data.readingPerformerName || data.readingPerformerPosition) ? "" : "col-start-1"}> {/* Adjust if only one signatory type exists */}
              <p className="mb-1 text-sm font-medium text-neutral-700">Prepared by:</p>
              <div className="mt-10 mb-1 border-b border-neutral-500 h-4"></div> {/* Signature line */}
              <p className="mt-1 text-sm font-semibold text-neutral-800">{data.signatoryName || "_________________________"}</p>
              <p className="text-xs text-neutral-600">{data.signatoryPosition || "Position"}</p>
            </div>
          )}
        </div>
      </div>

       <div className="mt-8 text-center text-xs text-neutral-500">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );

  return (
    <div id="invoice-to-export" className="max-w-[794px] mx-auto">
      {renderInvoiceContent("Client's Copy")}
      <div className="my-4 py-2 text-center border-t-2 border-b-2 border-dashed border-neutral-400 text-neutral-500 font-mono text-sm">
        ----------- Cut Here -----------
      </div>
      {renderInvoiceContent("Office Copy")}
    </div>
  );
}

