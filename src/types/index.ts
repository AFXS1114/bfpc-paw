
// This file can be used to define shared TypeScript types across the application.
import type { Timestamp, FieldValue } from "firebase/firestore";


export interface Reading {
  id: string;
  date: string; // ISO date string
  value: number;
  notes?: string;
}

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

export interface PowerReadingDocument extends Omit<PowerReadingEntry, 'id' | 'dateBilled' | 'createdAt'> {
  id: string;
  dateBilled: Date;
  createdAt?: Date;  // Optional as it might not be set on old data or if serverTimestamp is used
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

export type UtilityType = 'power' | 'water';

export interface MotherBillEntry {
  id?: string;
  utilityType: UtilityType;
  billingMonth: string;
  billingYear: number;
  pastReading: number;
  presentReading: number;
  totalConsumption: number;
  totalAmountBilled: number;
  notes?: string;
  createdAt: FieldValue | Timestamp;
}

export interface MotherBillDocument extends Omit<MotherBillEntry, 'id' | 'createdAt'> {
    id: string;
    utilityType: UtilityType;
    billingMonth: string;
    billingYear: number;
    pastReading: number;
    presentReading: number;
    totalConsumption: number;
    totalAmountBilled: number;
    notes?: string;
    createdAt: Date;
}

// For invoice generation modal and dedicated invoicing page
export interface InvoiceData {
  // From PowerReadingDocument
  clientName: string;
  stallNo: string;
  billingMonth: string;
  billingYear: number;
  clientPreviousReading: number;
  clientPresentReading: number;
  clientTotalKwh: number;

  // From MotherBillDocument
  motherBillTotalAmount: number;
  motherBillTotalConsumption: number;

  // Calculated
  basicRate: number;
  amountBeforeVAT: number;
  vatAmount: number;
  totalAmountDue: number;

  // New fields for dedicated invoice
  invoiceNumber: string;
  invoiceDate: string; // Formatted date string

  // Company details
  companyName: string;
  companyAddressLine1: string;
  companyAddressLine2?: string;
  companyLogoUrl?: string; // URL to a company logo
  paymentInstructions?: string;
}

// App User Management
export type AppUserRole = 'system-admin' | 'billing-officer';

export const APP_USER_ROLES: AppUserRole[] = ['system-admin', 'billing-officer'];
export const APP_USER_ROLE_LABELS: Record<AppUserRole, string> = {
  'system-admin': 'System Administrator',
  'billing-officer': 'Billing Officer',
};


export interface AppUserEntry {
  id?: string; // Firestore will generate this
  name: string;
  role: AppUserRole;
  email: string;
  passcode: string; // Stored as entered. Renewal logic is more complex and out of scope for this change.
  createdAt: FieldValue | Timestamp;
}

export interface AppUserDocument extends Omit<AppUserEntry, 'id' | 'createdAt'> {
  id: string;
  name: string;
  role: AppUserRole;
  email: string;
  passcode: string;
  createdAt: Date;
}
