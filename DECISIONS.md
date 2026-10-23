# Decisions

Questions I would have asked, ordered by how much they shaped the design.
`[Product]` = a business rule I'd confirm with you. `[Technical]` = an engineering choice I own.

---

### 1. When is credit committed to a campaign? `[Product]`
- **Assumed:** at scheduling. Scheduling is refused if credit doesn't cover all recipients.
- **Why:** the customer is present when scheduling and can top up; on send day they aren't.
- **If different:** checking only at send time would mean dropping the schedule check and the "reserved" amount, and failures would surface on event day.

### 2. Is the balance stored or calculated? `[Technical]`
- **Assumed:** calculated from orders, campaigns and messages every time, using one shared formula.
- **Why:** a stored number can drift and can't explain itself; cancellations need no special handling.
- **If different:** at scale, a cached balance column or an append-only ledger.

### 3. What happens when an order is cancelled after its credit was used? `[Product]`
- **Assumed:** always accepted. The order is kept as cancelled, the balance may go negative, and campaigns are not touched.
- **Why:** a refund or chargeback already happened in billing; refusing it only makes our data wrong. Auto-unscheduling would cause a surprise failure.
- **If different:** if debt isn't allowed, `CancelOrderService` would unschedule campaigns (latest first) and record why.

### 4. What if credit is short when a campaign is due? `[Product]`
- **Assumed:** send anyway; the customer owes the difference.
- **Why:** a missed event-day campaign is the worst case. Partial sending is worse still: random recipients are missed.
- **If different:** `SendDueCampaignsService` would check credit and mark short campaigns as blocked, with a reason.

### 5. How are conflicting dispatcher results handled? `[Product]`
- **Assumed:** accepted is final; a late acceptance overrides a rejection; duplicates are ignored. Every report is logged.
- **Why:** the customer pays for every accepted message, so once accepted, it must be charged.
- **If different:** if report timestamps were reliable, the latest report could win instead.

### 6. What does the dashboard show? `[Product]`
- **Assumed:** purchased, reserved, in flight, spent, available, plus the shortfall, at-risk campaigns, and cancelled orders.
- **Why:** after a cancellation nothing can be refused, so the dashboard is the only way to warn the customer before event day.
- **If different:** a single "available" number would hide why a campaign is at risk.

### 7. When credit is short, which campaign is at risk? `[Product]`
- **Assumed:** credit covers campaigns in send-time order; later ones are flagged first.
- **Why:** the soonest campaign is the most urgent; the customer has more time to fix later ones.
- **If different:** a customer-set priority could decide the order.

### 8. How do we stay correct with many servers running at once? `[Technical]`
- **Assumed:** every credit change locks the customer row first; sending uses `SKIP LOCKED`; results lock the message. Lock order is always customer → campaign → message. Unique constraints are the backstop.
- **Why:** Postgres row locks are enough and keep one source of truth (Redis was considered and rejected).
- **If different:** under heavy load on one customer, move to a ledger with optimistic versioning.

### 9. Can recipients be added after scheduling? `[Product]`
- **Assumed:** draft: always. Scheduled: only if there's credit for all new phones (all-or-nothing). Sent or cancelled: refused.
- **Why:** a clear refusal while editing beats a short campaign later.
- **If different:** allow the add and flag the campaign as at risk instead.

### 10. Can the same phone be on a campaign twice? `[Product]`
- **Assumed:** no. Duplicates are skipped quietly (in code and by a unique constraint) and not charged.
- **Why:** a repeated SMS is almost always a mistake the customer would pay for.
- **If different:** drop the unique constraint; each copy costs 1 credit.

### 11. Until when can recipients be removed? `[Product]`
- **Assumed:** until the campaign is sent. Unknown phones are ignored; credit is released automatically.
- **Why:** after sending, the messages are already with the dispatcher.
- **If different:** removing after sending would need the dispatcher to support recalling a message.

### 12. What are the scheduling rules? `[Product]`
- **Assumed:** draft only, at least 1 recipient, a future time, no limit on how far ahead. To change the time: cancel the schedule, then schedule again.
- **Why:** a past time is almost always a mistake; cancel and reschedule keeps the rules in one place.
- **If different:** add a max horizon (e.g. 90 days), so credit isn't held for months.

### 13. What if a result never arrives? `[Product]`
- **Assumed:** the message stays pending and keeps holding its credit.
- **Why:** we don't know if it was accepted; releasing the credit could allow overspending.
- **If different:** a timeout job would expire old pending messages under an agreed rule.

### 14. What if sending runs late? `[Product]`
- **Assumed:** overdue campaigns are sent on the next run, never skipped.
- **Why:** late is better than missing.
- **If different:** add an expiry window and mark stale campaigns as expired.

### 15. What triggers sending? `[Technical]`
- **Assumed:** the caller passes the time. In production, a cron would call it every minute (not built).
- **Why:** easy to test; correctness relies on DB locks, not on the scheduler.
- **If different:** nothing in the core changes.

### 16. Can a customer add credit at any time? `[Product]`
- **Assumed:** yes, with no limit. The amount must be a positive whole number.
- **Why:** an order is a payment that already happened in billing; the core just records it.
- **If different:** add a `pending` order status, counting only `active` orders.

### 17. Smaller assumptions
- Credit never expires; orders are cancelled fully, not partly.
- 1 recipient = 1 credit, whatever the SMS length.
- Phones use E.164; the same number in different formats counts as two.
- Customers are created outside this system.
- The `cancelled` campaign status is reserved for a future "delete campaign" action.

### Known gaps
- One failing campaign stops the whole `sendDue` run; it should be isolated and logged.
- A scheduled campaign can be emptied by removing all recipients, then "sent" with no messages.
- Balance queries run in READ COMMITTED; REPEATABLE READ would give one consistent snapshot.
