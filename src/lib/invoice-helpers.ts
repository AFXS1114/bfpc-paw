import type { InvoiceData } from "@/types";

async function imageToDataUrl(src: string): Promise<string | null> {
  if (typeof window === 'undefined') return null; // Safety check for SSR
  
  try {
    const response = await fetch(src, { cache: 'no-cache' });
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to data URL:", error);
    return null;
  }
}

// Single Invoice Template Content
const generateSingleInvoiceContent = (invoiceData: InvoiceData, copyTitle: string, companyHeader: any[]) => {
    const formatCurrency = (amount: number) => `P${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const consumptionUnit = invoiceData.consumptionUnit || 'units';
    const totalConsumptionValue = invoiceData.clientTotalKwh ?? invoiceData.clientTotalM3 ?? 0;
    
    return [
        { stack: companyHeader, margin: [0, 0, 0, 5] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 545, y2: 0, lineWidth: 1, lineColor: '#1E40AF' }], margin: [0, 0, 0, 10] },
        { text: `INVOICE (${copyTitle})`, style: 'invoiceTitle', alignment: 'right' as const },
        { text: `Invoice #: ${invoiceData.invoiceNumber}`, alignment: 'right' as const, style: 'small' },
        { text: `Date: ${invoiceData.invoiceDate}`, alignment: 'right' as const, style: 'small' },
        { canvas: [{ type: 'line' as const, x1: 0, y1: 3, x2: 515, y2: 3, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 3, 0, 5] as const },
        { 
          columns: [ 
            [ 
              { text: 'Bill To:', style: 'subheader' }, 
              { text: invoiceData.clientName, style: 'defaultCompact', bold: true }, 
              { text: `Stall No: ${invoiceData.stallNo}`, style: 'defaultCompact' }, 
            ], 
            [ 
              { text: 'Billing Period:', style: 'subheader', alignment: 'right' as const }, 
              { text: `${invoiceData.billingMonth} ${invoiceData.billingYear}`, alignment: 'right' as const, style: 'defaultCompact', bold: true }, 
            ] 
          ], 
          columnGap: 10, 
          margin: [0, 0, 0, 5] as const, 
        },
        { 
          style: 'itemsTable', 
          table: { 
            widths: ['*', 50, 50, 50, 60, 65], 
            body: [ 
              [ 
                { text: 'Description', style: 'tableHeader' }, 
                { text: `Prev.\n(${consumptionUnit})`, style: 'tableHeader', alignment: 'right' as const }, 
                { text: `Pres.\n(${consumptionUnit})`, style: 'tableHeader', alignment: 'right' as const }, 
                { text: `Cons.\n(${consumptionUnit})`, style: 'tableHeader', alignment: 'right' as const }, 
                { text: `Rate\n(P/${consumptionUnit})`, style: 'tableHeader', alignment: 'right' as const }, 
                { text: 'Amount\n(P)', style: 'tableHeader', alignment: 'right' as const }, 
              ], 
              [ 
                `${invoiceData.consumptionUnit === 'kWh' ? 'Power' : 'Water'} Consumption`, 
                { text: invoiceData.clientPreviousReading?.toLocaleString() ?? 'N/A', alignment: 'right' as const }, 
                { text: invoiceData.clientPresentReading?.toLocaleString() ?? 'N/A', alignment: 'right' as const }, 
                { text: totalConsumptionValue.toLocaleString(), alignment: 'right' as const, bold: true }, 
                { text: `P${(invoiceData.basicRate ?? 0).toFixed(4)}`, alignment: 'right' as const }, 
                { text: formatCurrency(totalConsumptionValue * (invoiceData.basicRate ?? 0)), alignment: 'right' as const }, 
              ] 
            ] 
          }, 
          layout: { 
            hLineWidth: () => 0.5, 
            vLineWidth: () => 0.5, 
            hLineColor: () => '#BFBFBF', 
            vLineColor: () => '#BFBFBF', 
            paddingLeft: () => 3, 
            paddingRight: () => 3, 
            paddingTop: () => 2, 
            paddingBottom: () => 2 
          } 
        },
        { 
          margin: [0, 2, 0, 2] as const, 
          table: { 
            widths: ['*'], 
            body: [ 
              [ 
                { 
                  text: [ 
                    { text: 'Rate Basis (MB ', style: 'smallHeader' }, 
                    { text: `${invoiceData.billingMonth} ${invoiceData.billingYear}):`, style: 'smallHeader', bold: true }, 
                    { text: ` MB Amt: ${formatCurrency(invoiceData.motherBillTotalAmount ?? 0)} | MB Cons: ${(invoiceData.motherBillTotalConsumption ?? 0).toLocaleString()} ${consumptionUnit}`, style: 'small' } 
                  ], 
                  fillColor: '#F5F5F5', 
                  border: [true, true, true, true], 
                  borderColor: ['#E0E0E0', '#E0E0E0', '#E0E0E0', '#E0E0E0'], 
                  margin: [0, 1], 
                } 
              ] 
            ] 
          }, 
          layout: 'noBorders' 
        },
        { 
          columns: [ 
            { width: '*', text: '' }, 
            { 
              width: 'auto', 
              style: 'summaryTable', 
              table: { 
                widths: ['auto', 'auto'], 
                body: [ 
                  ['Subtotal:', { text: formatCurrency(invoiceData.amountBeforeVAT), alignment: 'right' as const }], 
                  ['VAT (12%):', { text: formatCurrency(invoiceData.vatAmount), alignment: 'right' as const }], 
                  [
                    { text: 'Total Amount Due:', bold: true, style:'totalAmountKey' }, 
                    { text: formatCurrency(invoiceData.totalAmountDue), alignment: 'right' as const, bold: true, style:'totalAmountValue' }
                  ] 
                ] 
              }, 
              layout: 'noBorders' 
            } 
          ], 
          margin: [0, 2, 0, 5] as const 
        },
        { text: '', margin: [0,0,0,5] as const}, 
        invoiceData.paymentInstructions ? { text: 'Payment Instructions:', style: 'subheader', margin: [0, 2, 0, 1] as const } : {text:''}, 
        invoiceData.paymentInstructions ? { text: invoiceData.paymentInstructions, style: 'defaultCompact', margin: [0, 0, 0, 5] as const } : {text:''}, 
        { 
          columns: [ 
            (invoiceData.readingPerformerName || invoiceData.readingPerformerPosition) ? [ 
              { text: 'Readings Performed by:', style: 'small', margin: [0, 0, 0, 15] as const }, 
              { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const}, 
              { text: invoiceData.readingPerformerName || '', style: 'defaultCompact', bold: true }, 
              { text: invoiceData.readingPerformerPosition || '', style: 'small' }, 
            ] : {text: ''}, 
            (invoiceData.signatoryName || invoiceData.signatoryPosition) ? [ 
              { text: 'Prepared by:', style: 'small', margin: [0, 0, 0, 15] as const }, 
              { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const}, 
              { text: invoiceData.signatoryName || '', style: 'defaultCompact', bold: true }, 
              { text: invoiceData.signatoryPosition || '', style: 'small' }, 
            ] : {text: ''}, 
            (invoiceData.verifierName || invoiceData.verifierDesignation) ? [ 
              { text: 'Checked and Verified by:', style: 'small', margin: [0, 0, 0, 15] as const }, 
              { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const}, 
              { text: invoiceData.verifierName || '', style: 'defaultCompact', bold: true }, 
              { text: invoiceData.verifierDesignation || '', style: 'small' }, 
            ] : {text: ''} 
          ], 
          columnGap: 10, 
          margin: [0, 10, 0, 0] as const, 
        },
        { text: 'Received by: _________________________', style: 'defaultCompact', alignment: 'left' as const, margin: [0, 20, 0, 0] as const }
    ];
};

// Batch Invoice Template Content
const generateBatchInvoiceContent = (invoiceData: InvoiceData, companyHeader: any[]) => {
    const formatCurrency = (amount: number) => `P${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const tableBody: any[] = [ 
      [ 
        { text: 'Billing Period', style: 'tableHeader' }, 
        { text: `Cons.\n(${invoiceData.consumptionUnit})`, style: 'tableHeader', alignment: 'right' as const }, 
        { text: `Rate\n(P/${invoiceData.consumptionUnit})`, style: 'tableHeader', alignment: 'right' as const }, 
        { text: 'Amount\n(P)', style: 'tableHeader', alignment: 'right' as const }, 
      ] 
    ];
    
    invoiceData.lineItems?.forEach(item => { 
      tableBody.push([ 
        item.description, 
        { text: item.consumption.toLocaleString(), alignment: 'right' as const }, 
        { text: `P${item.rate.toFixed(4)}`, alignment: 'right' as const }, 
        { text: formatCurrency(item.amount), alignment: 'right' as const }, 
      ]); 
    });

    return [
        { stack: companyHeader, margin: [0, 0, 0, 5] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 545, y2: 0, lineWidth: 1, lineColor: '#1E40AF' }], margin: [0, 0, 0, 10] },
        { text: `INVOICE`, style: 'invoiceTitle', alignment: 'right' as const },
        { text: `Invoice #: ${invoiceData.invoiceNumber}`, alignment: 'right' as const, style: 'small' },
        { text: `Date: ${invoiceData.invoiceDate}`, alignment: 'right' as const, style: 'small' },
        { canvas: [{ type: 'line' as const, x1: 0, y1: 3, x2: 515, y2: 3, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 3, 0, 5] as const },
        { 
          columns: [ 
            [ 
              { text: 'Bill To:', style: 'subheader' }, 
              { text: invoiceData.clientName, style: 'defaultCompact', bold: true }, 
              { text: `Stall No: ${invoiceData.stallNo}`, style: 'defaultCompact' }, 
            ], 
            [ 
              { text: 'Billing For:', style: 'subheader', alignment: 'right' as const }, 
              { text: "Consolidated - All Selected Periods", alignment: 'right' as const, style: 'defaultCompact', bold: true }, 
            ] 
          ], 
          columnGap: 10, 
          margin: [0, 0, 0, 5] as const, 
        },
        { 
          style: 'itemsTable', 
          table: { widths: ['*', 50, 60, 65], body: tableBody }, 
          layout: { 
            hLineWidth: () => 0.5, 
            vLineWidth: () => 0.5, 
            hLineColor: () => '#BFBFBF', 
            vLineColor: () => '#BFBFBF', 
            paddingLeft: () => 3, 
            paddingRight: () => 3, 
            paddingTop: () => 2, 
            paddingBottom: () => 2 
          } 
        },
        { margin: [0, 2, 0, 2] as const, table: { widths: ['*'], body: [[]]}, layout: 'noBorders' },
        { 
          columns: [ 
            { width: '*', text: '' }, 
            { 
              width: 'auto', 
              style: 'summaryTable', 
              table: { 
                widths: ['auto', 'auto'], 
                body: [ 
                  ['Subtotal:', { text: formatCurrency(invoiceData.amountBeforeVAT), alignment: 'right' as const }], 
                  ['VAT (12%):', { text: formatCurrency(invoiceData.vatAmount), alignment: 'right' as const }], 
                  [
                    { text: 'Total Amount Due:', bold: true, style:'totalAmountKey' }, 
                    { text: formatCurrency(invoiceData.totalAmountDue), alignment: 'right' as const, bold: true, style:'totalAmountValue' }
                  ] 
                ] 
              }, 
              layout: 'noBorders' 
            } 
          ], 
          margin: [0, 2, 0, 5] as const 
        },
        { text: '', margin: [0,0,0,5] as const}, 
        invoiceData.paymentInstructions ? { text: 'Payment Instructions:', style: 'subheader', margin: [0, 2, 0, 1] as const } : {text:''}, 
        invoiceData.paymentInstructions ? { text: invoiceData.paymentInstructions, style: 'defaultCompact', margin: [0, 0, 0, 5] as const } : {text:''}, 
        { 
          columns: [ 
            (invoiceData.readingPerformerName || invoiceData.readingPerformerPosition) ? [ 
              { text: 'Readings Performed by:', style: 'small', margin: [0, 0, 0, 15] as const }, 
              { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const}, 
              { text: invoiceData.readingPerformerName || '', style: 'defaultCompact', bold: true }, 
              { text: invoiceData.readingPerformerPosition || '', style: 'small' }, 
            ] : {text: ''}, 
            (invoiceData.signatoryName || invoiceData.signatoryPosition) ? [ 
              { text: 'Prepared by:', style: 'small', margin: [0, 0, 0, 15] as const }, 
              { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const}, 
              { text: invoiceData.signatoryName || '', style: 'defaultCompact', bold: true }, 
              { text: invoiceData.signatoryPosition || '', style: 'small' }, 
            ] : {text: ''}, 
            (invoiceData.verifierName || invoiceData.verifierDesignation) ? [ 
              { text: 'Checked and Verified by:', style: 'small', margin: [0, 0, 0, 15] as const }, 
              { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const}, 
              { text: invoiceData.verifierName || '', style: 'defaultCompact', bold: true }, 
              { text: invoiceData.verifierDesignation || '', style: 'small' }, 
            ] : {text: ''} 
          ], 
          columnGap: 10, 
          margin: [0, 10, 0, 0] as const, 
        },
        { text: 'Received by: _________________________', style: 'defaultCompact', alignment: 'left' as const, margin: [0, 20, 0, 0] as const }
    ];
};

/**
 * Generates and downloads a PDF invoice using pdfMake.
 * This function runs entirely on the client side.
 */
export const generatePdf = async (invoiceData: InvoiceData, type: 'single' | 'batch') => {
    if (typeof window === 'undefined') return;

    // Dynamically import pdfmake and fonts to avoid SSR crashes
    const pdfMake = (await import("pdfmake/build/pdfmake")).default;
    const pdfFonts = (await import("pdfmake/build/vfs_fonts")).default;

    // Handle various pdfFonts export formats
    if (pdfFonts && (pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
    } else {
      (pdfMake as any).vfs = (pdfFonts as any).default?.pdfMake?.vfs || pdfFonts;
    }
    
    const logoDataUrl = await imageToDataUrl('/company-logo.png');

    const companyHeader: any[] = [];
    if (logoDataUrl) {
        companyHeader.push({ image: logoDataUrl, width: 50, alignment: 'left' as const, margin: [0, 0, 0, 5] as const });
    }
    companyHeader.push(
        { text: invoiceData.companyName, style: 'header', alignment: 'left' as const, margin: [0,0,0,0] as const},
        { text: invoiceData.companyAddressLine1, style: 'address', alignment: 'left' as const, margin: [0,0,0,0] as const}
    );
     if (invoiceData.companyAddressLine2) {
        companyHeader.push({ text: invoiceData.companyAddressLine2, style: 'address', alignment: 'left' as const, margin: [0,0,0,1] as const });
    }

    let invoiceContentBody;
    if (type === 'single') {
        invoiceContentBody = [ 
          ...generateSingleInvoiceContent(invoiceData, "Client's Copy", companyHeader), 
          { text: ' ', margin: [0, 10, 0, 10] }, 
          { canvas: [{ type: 'line', x1: 5, y1: 5, x2: 515, y2: 5, dash: { length: 5, space: 2 }, lineColor: '#aaaaaa' }], margin: [0, 0, 0, 10] }, 
          { text: ' ', margin: [0, 10, 0, 10] }, 
          ...generateSingleInvoiceContent(invoiceData, "Office Copy", companyHeader) 
        ];
    } else { // Batch
        invoiceContentBody = generateBatchInvoiceContent(invoiceData, companyHeader);
    }
    
    const documentDefinition: any = {
      content: invoiceContentBody,
      defaultStyle: { fontSize: 7.5, lineHeight: 1.0, font: "Roboto" },
      styles: { 
        header: { fontSize: 10, bold: true, margin: [0, 0, 0, 1], color: '#333333' }, 
        address: { fontSize: 6.5, margin: [0,0,0,1], color: '#4A4A4A'}, 
        invoiceTitle: { fontSize: 14, bold: true, color: '#1E40AF', margin: [0, 0, 0, 1] }, 
        subheader: { fontSize: 7.5, bold: true, margin: [0, 1, 0, 1], color: '#333333' }, 
        itemsTable: { margin: [0, 2, 0, 2], fontSize: 6.5 }, 
        tableHeader: { bold: true, fontSize: 6.5, color: '#1F2937'}, 
        summaryTable: { margin: [0,0,0,2], fontSize: 7}, 
        totalAmountKey: {fontSize: 7.5, bold:true, color: '#1E40AF'}, 
        totalAmountValue: {fontSize: 7.5, bold:true, color: '#1E40AF'}, 
        smallHeader: { fontSize: 6, color: '#4A4A4A'}, 
        small: { fontSize: 6, color: '#4A4A4A'}, 
        defaultCompact: {fontSize: 7, color: '#333333'} 
      },
      pageSize: 'A4', 
      pageOrientation: 'portrait', 
      pageMargins: [25, 25, 25, 25], 
      footer: (currentPage: number, pageCount: number) => { 
        return { text: `Page ${currentPage.toString()} of ${pageCount.toString()}`, alignment: 'center' as const, style: 'small', margin: [0,0,0,10] as const }; 
      }
    };

    pdfMake.createPdf(documentDefinition).download(`Invoice-${invoiceData.invoiceNumber}.pdf`);
};
