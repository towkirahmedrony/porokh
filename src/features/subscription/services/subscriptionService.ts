import apiClient from '@/shared/lib/apiClient';
import { SubscriptionPlan, PaymentRequestPayload, PaymentMethod } from '../types/subscription';

export const subscriptionService = {
  /**
   * Fetches all active subscription plans.
   */
  async fetchActivePlans(): Promise<SubscriptionPlan[]> {
    const response = await apiClient.get('/finance/plans');
    // Added safety fallback to prevent crashes if response.data.data is undefined
    return (response.data?.data as SubscriptionPlan[]) ?? [];
  },

  /**
   * Fetches a single plan by its ID.
   * NOTE: Currently fetches all plans and filters in-memory.
   * If a dedicated endpoint exists (e.g., /finance/plans/:id), update this method.
   */
  async fetchPlanById(id: string): Promise<SubscriptionPlan | null> {
    const plans = await this.fetchActivePlans();
    return plans.find((plan) => plan.id === id) || null;
  },

  /**
   * Fetches available manual payment methods (e.g., bKash, Nagad).
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await apiClient.get('/finance/methods');
    return (response.data?.data as PaymentMethod[]) ?? [];
  },

  /**
   * Submits a manual payment claim for verification.
   */
  async submitPaymentClaim(payload: PaymentRequestPayload) {
    const response = await apiClient.post('/finance/payments/claim', payload);
    return response.data?.data;
  }
};
