
"use client";

import type { InvoiceData } from "@/types";
import { format } from "date-fns";
import Image from "next/image";

interface InvoiceTemplateProps {
  data: InvoiceData;
}

export function InvoiceTemplate({ data }: InvoiceTemplateProps) {
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
    <div className="p-6 bg-white text-neutral-900 font-sans text-sm max-w-[550px] w-full border border-neutral-300 rounded-lg shadow-lg break-inside-avoid flex-shrink-0 flex flex-col">
      <header className="flex justify-between items-start pb-4 border-b border-neutral-300 mb-4">
        <div>
          <Image
            src={companyLogoPath}
            alt={`${data.companyName || 'Company'} Logo`}
            width={100}
            height={50}
            className="mb-1 object-contain"
            data-ai-hint="company logo"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x50.png?text=No+Logo'; }}
          />
          <h1 className="text-xl font-bold text-blue-700">{data.companyName}</h1>
          <p className="text-xs text-neutral-700">{data.companyAddressLine1}</p>
          {data.companyAddressLine2 && <p className="text-xs text-neutral-700">{data.companyAddressLine2}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <h2 className="text-2xl font-semibold text-blue-600 mb-1">INVOICE {copyIdentifier && <span className="text-xs block normal-case">({copyIdentifier})</span>}</h2>
          <p className="text-xs text-neutral-800">
            <span className="font-medium">Invoice #:</span> {data.invoiceNumber}
          </p>
          <p className="text-xs text-neutral-800">
            <span className="font-medium">Date:</span> {data.invoiceDate}
          </p>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-2">
        <div>
          <h3 className="font-semibold text-blue-700 mb-1 text-sm">Bill To:</h3>
          <p className="font-medium text-neutral-800 text-xs">{data.clientName}</p>
          <p className="text-neutral-700 text-xs">Stall No: {data.stallNo}</p>
        </div>
        <div className="text-right">
           <h3 className="font-semibold text-blue-700 mb-1 text-sm">Billing Period:</h3>
           <p className="text-neutral-700 text-xs">{data.billingMonth} {data.billingYear}</p>
        </div>
      </section>

      <section className="mb-6">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-100 text-left text-neutral-800">
              <th className="p-1 border border-neutral-300 font-medium">Description</th>
              <th className="p-1 border border-neutral-300 font-medium text-right whitespace-nowrap">Prev.<br/>(kWh)</th>
              <th className="p-1 border border-neutral-300 font-medium text-right whitespace-nowrap">Pres.<br/>(kWh)</th>
              <th className="p-1 border border-neutral-300 font-medium text-right whitespace-nowrap">Cons.<br/>(kWh)</th>
              <th className="p-1 border border-neutral-300 font-medium text-right whitespace-nowrap">Rate<br/>(₱/kWh)</th>
              <th className="p-1 border border-neutral-300 font-medium text-right whitespace-nowrap">Amount<br/>(₱)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-neutral-700">
              <td className="p-1 border border-neutral-300">Power Consumption</td>
              <td className="p-1 border border-neutral-300 text-right">{data.clientPreviousReading.toLocaleString()}</td>
              <td className="p-1 border border-neutral-300 text-right">{data.clientPresentReading.toLocaleString()}</td>
              <td className="p-1 border border-neutral-300 text-right font-medium">{data.clientTotalKwh.toLocaleString()}</td>
              <td className="p-1 border border-neutral-300 text-right">₱{data.basicRate.toFixed(4)}</td>
              <td className="p-1 border border-neutral-300 text-right">{formatCurrency(data.clientTotalKwh * data.basicRate)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6 p-2 bg-neutral-50 rounded-md text-[10px] text-neutral-700">
        <h4 className="font-semibold mb-0.5 text-blue-600">Rate Calculation Basis (Mother Bill {data.billingMonth} {data.billingYear}):</h4>
        <div className="grid grid-cols-2 gap-x-2">
            <p>Total MB Amount: {formatCurrency(data.motherBillTotalAmount)}</p>
            <p>Total MB Cons: {data.motherBillTotalConsumption.toLocaleString()} kWh</p>
        </div>
      </section>

      <section className="flex justify-end mb-6 text-neutral-800 text-xs">
        <div className="w-full md:w-2/3 space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(data.amountBeforeVAT)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (12%):</span>
            <span>{formatCurrency(data.vatAmount)}</span>
          </div>
          <hr className="my-0.5 border-neutral-300"/>
          <div className="flex justify-between font-bold text-sm text-blue-700">
            <span>Total Amount Due:</span>
            <span>{formatCurrency(data.totalAmountDue)}</span>
          </div>
        </div>
      </section>

      <div className="flex-grow"></div>

      {data.paymentInstructions && (
        <footer className="pt-4 border-t border-neutral-300 text-neutral-700 mt-auto">
          <h3 className="font-semibold text-blue-700 mb-1 text-sm">Payment Instructions:</h3>
          <p className="text-[10px] whitespace-pre-line">{data.paymentInstructions}</p>
        </footer>
      )}

      <div className="mt-8 pt-4 border-t border-neutral-300 text-xs">
        <div className="grid grid-cols-2 gap-4">
          {(data.readingPerformerName || data.readingPerformerPosition) && (
            <div>
              <p className="mb-0.5 text-[10px] font-medium text-neutral-700">Readings Performed by:</p>
              <div className="mt-6 mb-0.5 border-b border-neutral-500 h-3"></div>
              <p className="mt-0.5 text-[10px] font-semibold text-neutral-800">{data.readingPerformerName || "___________________"}</p>
              <p className="text-[9px] text-neutral-600">{data.readingPerformerPosition || "Position"}</p>
            </div>
          )}
           {(data.signatoryName || data.signatoryPosition) && (
            <div className={(data.readingPerformerName || data.readingPerformerPosition) ? "" : "col-start-1"}>
              <p className="mb-0.5 text-[10px] font-medium text-neutral-700">Prepared by:</p>
              <div className="mt-6 mb-0.5 border-b border-neutral-500 h-3"></div>
              <p className="mt-0.5 text-[10px] font-semibold text-neutral-800">{data.signatoryName || "___________________"}</p>
              <p className="text-[9px] text-neutral-600">{data.signatoryPosition || "Position"}</p>
            </div>
          )}
        </div>
      </div>

       <div className="mt-6 text-center text-[10px] text-neutral-500">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );

  return (
    <div 
      id="invoice-to-export" 
      className="max-w-[1122px] mx-auto flex flex-row justify-center items-start gap-4 bg-white"
    > {/* Changed bg to white, removed py-4 px-2, increased gap slightly */}
      {renderInvoiceContent("Client's Copy")}
      
      <div className="flex flex-col items-center self-stretch justify-center min-h-full py-8 mx-1"> {/* Added py-8 for cut line height */}
        <div className="w-px border-l-2 border-dashed border-neutral-400 flex-grow"></div>
        <span 
            className="my-2 text-neutral-500 font-mono text-xs" 
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
            CUT HERE
        </span>
        <div className="w-px border-l-2 border-dashed border-neutral-400 flex-grow"></div>
      </div>
      
      {renderInvoiceContent("Office Copy")}
    </div>
  );
}
    