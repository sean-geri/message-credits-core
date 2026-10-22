import { EntityManager } from 'typeorm';

/**
 * Caller must already hold the customer row lock. This function does not lock.
 * The result may be negative.
 */
export async function calculateAvailableCredit(
  em: EntityManager,
  customerId: string,
): Promise<number> {
  const rows: Array<{ available: string | number }> = await em.query(
    `
      SELECT
        COALESCE((
          SELECT SUM(credits)
          FROM orders
          WHERE customer_id = $1 AND status = 'active'
        ), 0)
        - COALESCE((
          SELECT COUNT(*)
          FROM recipients recipient
          INNER JOIN campaigns campaign ON campaign.id = recipient.campaign_id
          WHERE campaign.customer_id = $1 AND campaign.status = 'scheduled'
        ), 0)
        - COALESCE((
          SELECT COUNT(*)
          FROM messages message
          INNER JOIN campaigns campaign ON campaign.id = message.campaign_id
          WHERE campaign.customer_id = $1
            AND message.status IN ('pending', 'accepted')
        ), 0) AS available
    `,
    [customerId],
  );

  return Number(rows[0].available);
}
