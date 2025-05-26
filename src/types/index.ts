
// This file can be used to define shared TypeScript types across the application.
import type { Timestamp, FieldValue } from "firebase/firestore";


export interface Reading {
  id: string;
  date: string; // ISO date string
  value: number;
  notes?: string;
}

// This PowerReading is the old one, can be removed or kept if used elsewhere.
// For the new form, we'll use PowerReadingEntry and PowerReadingFormData.
export interface PowerReading extends Reading {}

export interface WaterReading extends Reading {}

// This is a general MotherBill type, the existing /billing page uses something similar.
// The new /mother-bill page will use MotherBillEntry for more specific power-related mother bills.
export interface MotherBill {
  id:string;
  period: string; // e.g., "YYYY-MM"
  totalAmount: number;
  totalPowerConsumption?: number; // in kWh
  totalWaterConsumption?: number; // in m³
}

export interface Tenant {
  id: string;
  name: string;
}

export interface TenantBill {
  id: string;
  motherBillId: string;
  tenantId: string;
  powerConsumption?: number;
  waterConsumption?: number;
  calculatedAmount: number;
}

export interface Client {
  id?: string; // Firestore will generate this
  stallNo: string;
  clientName: string;
  businessName: string;
  waterMeterNo: string;
  powerMeterNo: string;
  createdAt?: FieldValue | Timestamp; // For Firestore server timestamp or fetched Timestamp
}

// For client documents fetched from Firestore, including their ID
export interface ClientDocument extends Client {
  id: string;
  createdAt?: Timestamp;
}


// Type for the power reading entries to be saved in Firestore
export interface PowerReadingEntry {
  id?: string; // Firestore will generate this
  clientId: string;
  clientName: string; // Denormalized for easier display
  stallNo: string; // Denormalized
  powerMeterNo: string; // Denormalized
  dateBilled: FieldValue | Timestamp; // Date of billing // FieldValue for writing, Timestamp for reading
  billingMonth: string; // e.g., "January", "February"
  billingYear: number;
  previousReading: number;
  presentReading: number;
  totalKwh: number;
  notes?: string;
  createdAt: FieldValue | Timestamp; // Firestore server timestamp // FieldValue for writing, Timestamp for reading
}

// For power reading documents fetched from Firestore, including their ID
// Note: dateBilled and createdAt will be JS Date objects after fetching and transformation
export interface PowerReadingDocument extends Omit<PowerReadingEntry, 'id' | 'dateBilled' | 'createdAt'> {
  id: string;
  dateBilled: Date; // JS Date object for easier use in the component
  createdAt: Date;  // JS Date object
  // All other fields from PowerReadingEntry remain as they are
  clientId: string;
  clientName: string;
  stallNo: string;
  powerMeterNo: string;
  billingMonth: string;
  billingYear: number;
  previousReading: number;
  presentReading: number;
  totalKwh: number;
  notes?: string;
}

// Type for the mother bill entries to be saved in Firestore
export interface MotherBillEntry {
  id?: string; // Firestore will generate this
  billingMonth: string; // e.g., "January", "February"
  billingYear: number;
  pastReading: number; // kWh
  presentReading: number; // kWh
  totalKwh: number; // kWh (calculated)
  totalAmountBilled: number; // $
  notes?: string;
  createdAt: FieldValue | Timestamp; // Firestore server timestamp
}

// For mother bill documents fetched from Firestore
export interface MotherBillDocument extends Omit<MotherBillEntry, 'id' | 'createdAt'> {
    id: string;
    billingMonth: string;
    billingYear: number;
    pastReading: number;
    presentReading: number;
    totalKwh: number;
    totalAmountBilled: number;
    notes?: string;
    createdAt: Date; // JS Date object for easier use in the component
}
    
