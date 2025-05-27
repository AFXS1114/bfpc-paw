
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

  // This function renders the actual content of one invoice
  const renderInvoiceContent = () => (
    <div className="bg-white text-neutral-900 font-sans text-sm w-full border border-neutral-300 rounded-lg shadow-lg p-6 flex flex-col min-h-[1000px]">
      <header className="flex justify-between items-start pb-4 border-b border-neutral-300 mb-4">
        <div>
          <Image
            src={companyLogoPath}
            alt={`${data.companyName || 'Company'} Logo`}
            width={100}
            height={50}
            className="mb-2 object-contain"
            data-ai-hint="company logo"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x50.png?text=No+Logo'; }}
          />
          <h1 className="text-xl font-bold text-blue-700">{data.companyName}</h1>
          <p className="text-xs text-neutral-700">{data.companyAddressLine1}</p>
          {data.companyAddressLine2 && <p className="text-xs text-neutral-700">{data.companyAddressLine2}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <h2 className="text-2xl font-semibold text-blue-600 mb-1">INVOICE</h2>
          <p className="text-xs text-neutral-800">
            <span className="font-medium">Invoice #:</span> {data.invoiceNumber}
          </p>
          <p className="text-xs text-neutral-800">
            <span className="font-medium">Date:</span> {data.invoiceDate}
          </p>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-4">
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

      <section className="mb-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-white text-left text-neutral-800"> {/* Changed bg-neutral-100 to bg-white */}
              <th className="p-2 border border-neutral-300 font-medium">Description</th>
              <th className="p-2 border border-neutral-300 font-medium text-right whitespace-nowrap">Prev.<br/>(kWh)</th>
              <th className="p-2 border border-neutral-300 font-medium text-right whitespace-nowrap">Pres.<br/>(kWh)</th>
              <th className="p-2 border border-neutral-300 font-medium text-right whitespace-nowrap">Cons.<br/>(kWh)</th>
              <th className="p-2 border border-neutral-300 font-medium text-right whitespace-nowrap">Rate<br/>(₱/kWh)</th>
              <th className="p-2 border border-neutral-300 font-medium text-right whitespace-nowrap">Amount<br/>(₱)</th>
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

      <section className="mb-4 p-2 bg-white rounded-md text-xs text-neutral-700 border border-neutral-300"> {/* Changed bg-neutral-50 to bg-white and added border */}
        <h4 className="font-semibold mb-1 text-blue-600">Rate Calculation Basis (Mother Bill {data.billingMonth} {data.billingYear}):</h4>
        <div className="grid grid-cols-2 gap-x-2">
            <p>Total MB Amount: {formatCurrency(data.motherBillTotalAmount)}</p>
            <p>Total MB Cons: {data.motherBillTotalConsumption.toLocaleString()} kWh</p>
        </div>
      </section>

      <section className="flex justify-end mb-4 text-neutral-800 text-sm">
        <div className="w-full md:w-1/2 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(data.amountBeforeVAT)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (12%):</span>
            <span>{formatCurrency(data.vatAmount)}</span>
          </div>
          <hr className="my-1 border-neutral-300"/>
          <div className="flex justify-between font-bold text-base text-blue-700">
            <span>Total Amount Due:</span>
            <span>{formatCurrency(data.totalAmountDue)}</span>
          </div>
        </div>
      </section>

      <div className="flex-grow"></div>

      {data.paymentInstructions && (
        <footer className="pt-3 border-t border-neutral-300 text-neutral-700 mt-auto mb-4">
          <h3 className="font-semibold text-blue-700 mb-1 text-sm">Payment Instructions:</h3>
          <p className="text-xs whitespace-pre-line">{data.paymentInstructions}</p>
        </footer>
      )}

      <div className="mt-auto pt-3 border-t border-neutral-300 text-xs">
        <div className="grid grid-cols-2 gap-4">
          {(data.readingPerformerName || data.readingPerformerPosition) && (
            <div>
              <p className="mb-1 text-sm font-medium text-neutral-700">Readings Performed by:</p>
              <div className="mt-8 mb-1 border-b border-neutral-500 h-4"></div>
              <p className="mt-1 text-sm font-semibold text-neutral-800">{data.readingPerformerName || "___________________"}</p>
              <p className="text-xs text-neutral-600">{data.readingPerformerPosition || "Position"}</p>
            </div>
          )}
           {(data.signatoryName || data.signatoryPosition) && (
            <div className={(data.readingPerformerName || data.readingPerformerPosition) ? "" : "col-start-1"}> {/* Adjusted col-start for centering if only signatory is present */}
              <p className="mb-1 text-sm font-medium text-neutral-700">Prepared by:</p>
              <div className="mt-8 mb-1 border-b border-neutral-500 h-4"></div>
              <p className="mt-1 text-sm font-semibold text-neutral-800">{data.signatoryName || "___________________"}</p>
              <p className="text-xs text-neutral-600">{data.signatoryPosition || "Position"}</p>
            </div>
          )}
        </div>
      </div>

       <div className="mt-4 text-center text-xs text-neutral-500">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );

  return (
    <div
      id="invoice-to-export"
      className="max-w-[794px] mx-auto bg-white" 
    >
      {renderInvoiceContent()}
    </div>
  );
}

