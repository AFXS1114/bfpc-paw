
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


// New type for the power reading entries to be saved in Firestore
export interface PowerReadingEntry {
  id?: string; // Firestore will generate this
  clientId: string;
  clientName: string; // Denormalized for easier display
  stallNo: string; // Denormalized
  powerMeterNo: string; // Denormalized
  dateBilled: FieldValue | Timestamp; // Date of billing
  billingMonth: string; // e.g., "January", "February"
  billingYear: number;
  previousReading: number;
  presentReading: number;
  totalKwh: number;
  notes?: string;
  createdAt: FieldValue | Timestamp; // Firestore server timestamp
}

// For power reading documents fetched from Firestore, including their ID
export interface PowerReadingDocument extends Omit<PowerReadingEntry, 'dateBilled' | 'createdAt'> {
  id: string;
  dateBilled: Timestamp;
  createdAt: Timestamp;
}
