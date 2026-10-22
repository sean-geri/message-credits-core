import { EntityManager } from 'typeorm';
import { calculateCreditBreakdown } from './calculate-credit-breakdown';

/**
 * Caller must already hold the customer row lock. This function does not lock.
 * The result may be negative.
 */
export async function calculateAvailableCredit(
  em: EntityManager,
  customerId: string,
): Promise<number> {
  const breakdown = await calculateCreditBreakdown(em, customerId);

  return breakdown.available;
}
