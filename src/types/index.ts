
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
