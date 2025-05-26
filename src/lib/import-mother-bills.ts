
// src/lib/import-mother-bills.ts
"use server"; // Marking as server action, though it's client-invoked for this one-time utility

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { MotherBillEntry } from "@/types";

const historicalData = {
  "-ORDUkHbNu-zDSBjYGn4": {
    "BILL FTM OF": "January 2023",
    "PRESENT": 941,
    "PREVIOUS": 924,
    "KWH USED": 4760,
    " TOTAL AMOUNT ": " ₱71,778.78 "
  },
  "-ORDUkHb7ll_th9lj7Qr": {
    "BILL FTM OF": "February 2023",
    "PRESENT": 961,
    "PREVIOUS": 941,
    "KWH USED": 5600,
    " TOTAL AMOUNT ": " ₱79,193.25 "
  },
  "-ORDUkHbFT5vsTbJMvf_": {
    "BILL FTM OF": "March 2023",
    "PRESENT": 982,
    "PREVIOUS": 961,
    "KWH USED": 5880,
    " TOTAL AMOUNT ": " ₱87,983.90 "
  },
  "-ORDUkHbJKGhi0pjbu1m": {
    "BILL FTM OF": "April 2023",
    "PRESENT": 1007,
    "PREVIOUS": 982,
    "KWH USED": 7000,
    " TOTAL AMOUNT ": " ₱94,963.53 "
  },
  "-ORDUkHb5b0DyoqNzU4y": {
    "BILL FTM OF": "May 2023",
    "PRESENT": 1037,
    "PREVIOUS": 1007,
    "KWH USED": 8400,
    " TOTAL AMOUNT ": " ₱111,224.60 "
  },
  "-ORDUkHbDXzCHHW7oWag": {
    "BILL FTM OF": "June 2023",
    "PRESENT": 1065,
    "PREVIOUS": 1037,
    "KWH USED": 7840,
    " TOTAL AMOUNT ": " ₱104,515.64 "
  },
  "-ORDUkHbwMDH3EFVYozs": {
    "BILL FTM OF": "July 2023",
    "PRESENT": 1090,
    "PREVIOUS": 1065,
    "KWH USED": 7000,
    " TOTAL AMOUNT ": " ₱81,014.76 "
  },
  "-ORDUkHb9fdALbrt_KzO": {
    "BILL FTM OF": "August 2023",
    "PRESENT": 1118,
    "PREVIOUS": 1090,
    "KWH USED": 7840,
    " TOTAL AMOUNT ": " ₱86,827.46 "
  },
  "-ORDUkHb64vD8CYZBRxd": {
    "BILL FTM OF": "September 2023",
    "PRESENT": 1146,
    "PREVIOUS": 1118,
    "KWH USED": 7840,
    " TOTAL AMOUNT ": " ₱78,502.09 "
  },
  "-ORDUkHbqVl3XhiirCS2": {
    "BILL FTM OF": "October 2023",
    "PRESENT": 1173,
    "PREVIOUS": 1146,
    "KWH USED": 7560,
    " TOTAL AMOUNT ": " ₱68,249.48 "
  },
  "-ORDUkHbfBo6JiX_WY9e": {
    "BILL FTM OF": "November 2023",
    "PRESENT": 1198,
    "PREVIOUS": 1173,
    "KWH USED": 7000,
    " TOTAL AMOUNT ": " ₱71,257.24 "
  },
  "-ORDUkHbEwzqWxFtO8DN": {
    "BILL FTM OF": "December 2023",
    "PRESENT": 1222,
    "PREVIOUS": 1198,
    "KWH USED": 6720,
    " TOTAL AMOUNT ": " ₱64,660.99 "
  },
  "-ORDUkHbIKBgPxgqqvD6": {
    "BILL FTM OF": "January 2024",
    "PRESENT": 1246,
    "PREVIOUS": 1222,
    "KWH USED": 6720,
    " TOTAL AMOUNT ": " ₱65,316.30 "
  },
  "-ORDUkHbj3imv_Ro_Rfj": {
    "BILL FTM OF": "February 2024",
    "PRESENT": 1266,
    "PREVIOUS": 1246,
    "KWH USED": 5600,
    " TOTAL AMOUNT ": " ₱54,136.91 "
  },
  "-ORDUkHbdnMn4P0tPLv9": {
    "BILL FTM OF": "March 2024",
    "PRESENT": 1290,
    "PREVIOUS": 1266,
    "KWH USED": 6720,
    " TOTAL AMOUNT ": " ₱70,605.60 "
  },
  "-ORDUkHb1IC93SBWhIws": {
    "BILL FTM OF": "April 2024",
    "PRESENT": 1314,
    "PREVIOUS": 1290,
    "KWH USED": 6720,
    " TOTAL AMOUNT ": " ₱72,752.01 "
  },
  "-ORDUkHbYvRlzDMTixZ5": {
    "BILL FTM OF": "May 2024",
    "PRESENT": 1314,
    "PREVIOUS": 1314,
    "KWH USED": 7280,
    " TOTAL AMOUNT ": " ₱83,678.69 "
  },
  "-ORDUkHb10L7yiYRellu": {
    "BILL FTM OF": "June 2024",
    "PRESENT": 1365,
    "PREVIOUS": 1314,
    "KWH USED": 7000,
    " TOTAL AMOUNT ": " ₱57,036.53 "
  },
  "-ORDUkHbia91AEcRs710": {
    "BILL FTM OF": "July 2024",
    "PRESENT": 1391,
    "PREVIOUS": 1365,
    "KWH USED": 7280,
    " TOTAL AMOUNT ": " ₱73,655.54 "
  },
  "-ORDUkHbRTcrxHg1VPYu": {
    "BILL FTM OF": "August 2024",
    "PRESENT": 1418,
    "PREVIOUS": 1391,
    "KWH USED": 7560,
    " TOTAL AMOUNT ": " ₱96,121.62 "
  },
  "-ORDUkHb4MG7lg49SYYl": {
    "BILL FTM OF": "September 2024",
    "PRESENT": 1442,
    "PREVIOUS": 1418,
    "KWH USED": 6720,
    " TOTAL AMOUNT ": " ₱89,914.63 "
  },
  "-ORDUkHb59qXJiMW59hp": {
    "BILL FTM OF": "October 2024",
    "PRESENT": 1467,
    "PREVIOUS": 1442,
    "KWH USED": 7000,
    " TOTAL AMOUNT ": " ₱68,419.57 "
  },
  "-ORDUkHbkeZoKYNLBqhg": {
    "BILL FTM OF": "November 2024",
    "PRESENT": 1492,
    "PREVIOUS": 1467,
    "KWH USED": 7000,
    " TOTAL AMOUNT ": " ₱73,827.18 "
  },
  "-ORDUkHbbHPcfb8mA01y": {
    "BILL FTM OF": "December 2024",
    "PRESENT": 1514,
    "PREVIOUS": 1492,
    "KWH USED": 6160,
    " TOTAL AMOUNT ": " ₱64,746.69 "
  },
  "-ORDUkHbrT7DYS-41J7m": {
    "BILL FTM OF": "January 2025",
    "PRESENT": 1535,
    "PREVIOUS": 1514,
    "KWH USED": 5880,
    " TOTAL AMOUNT ": " ₱58,657.29 "
  },
  "-ORDUkHbrm63IUezY32s": {
    "BILL FTM OF": "February 2025",
    "PRESENT": "",
    "PREVIOUS": 1535,
    "KWH USED": 7000,
    " TOTAL AMOUNT ": " ₱65,745.98 "
  },
  "-ORDUkHbS0ob0bEDehOg": {
    "BILL FTM OF": "March 2025",
    "PRESENT": "",
    "PREVIOUS": 0,
    "KWH USED": 6720,
    " TOTAL AMOUNT ": " ₱64,413.20 "
  },
  "-ORDUkHbGkaHttbp7GqQ": {
    "BILL FTM OF": "April 2025",
    "PRESENT": 1612,
    "PREVIOUS": 1584,
    "KWH USED": 7840,
    " TOTAL AMOUNT ": " ₱87,271.56 "
  }
};

export async function importHistoricalMotherBills(): Promise<{ success: boolean; count: number; error?: string }> {
  let importedCount = 0;
  const motherBillsCollection = collection(db, "mother-bills");

  for (const key in historicalData) {
    if (Object.prototype.hasOwnProperty.call(historicalData, key)) {
      // The type assertion helps TypeScript understand the structure of item
      const item = historicalData[key as keyof typeof historicalData] as {
        "BILL FTM OF": string;
        "PRESENT": number | string; // Can be number or empty string
        "PREVIOUS": number;
        "KWH USED": number;
        " TOTAL AMOUNT ": string;
      };

      try {
        const billPeriod = item["BILL FTM OF"].split(" ");
        const billingMonth = billPeriod[0];
        const billingYear = parseInt(billPeriod[1], 10);

        const kwhUsed = Number(item["KWH USED"]) || 0;
        
        let totalAmountBilledStr = item[" TOTAL AMOUNT "].trim();
        totalAmountBilledStr = totalAmountBilledStr.replace("₱", "").replace(/,/g, "");
        const totalAmountBilled = parseFloat(totalAmountBilledStr) || 0;

        const newEntry: Omit<MotherBillEntry, "id" | "createdAt"> & { createdAt: any } = {
          billingMonth,
          billingYear,
          pastReading: 0, // As discussed, setting pastReading to 0
          presentReading: kwhUsed, // Setting presentReading to KWH USED
          totalKwh: kwhUsed, // KWH USED from JSON is our totalKwh
          totalAmountBilled,
          notes: "Historical data import",
          createdAt: serverTimestamp(),
        };

        await addDoc(motherBillsCollection, newEntry);
        importedCount++;
      } catch (e) {
        console.error("Error importing record: ", item, e);
        return { success: false, count: importedCount, error: `Failed to import record for ${item["BILL FTM OF"]}: ${(e as Error).message}` };
      }
    }
  }
  return { success: true, count: importedCount };
}
