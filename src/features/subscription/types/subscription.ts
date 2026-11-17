import { Tables } from '@/shared/types/supabase';

// Maps directly to the Supabase Database Schema
export type SubscriptionPlan = Tables<'subscription_plans'>;

export interface PaymentRequestPayload {
  user_id: string;
  plan_id: string;
  amount: number;
  method: string;
  sender_number: string;
  trx_id: string;
  // Optional fields for schema compatibility
  coupon_code?: string; 
  currency?: string;    
}

export interface PaymentMethod {
  id: string;
  name: string;
  color?: string;
  bgColor?: string;
  icon?: string;
  number: string;
  type: string;
}
