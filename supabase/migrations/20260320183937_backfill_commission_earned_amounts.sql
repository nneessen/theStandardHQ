-- Backfill earned_amount, months_paid, unearned_amount for all commissions
-- linked to policies, using effective_date to calculate months elapsed.
--
-- Logic:
-- 1. For active/lapsed policies: months elapsed = NOW() - effective_date
-- 2. For cancelled policies: months elapsed = cancellation_date - effective_date
-- 3. months_paid is capped at advance_months (default 9)
-- 4. earned_amount = (months_paid / advance_months) * amount
-- 5. unearned_amount = amount - earned_amount

UPDATE commissions c
SET
  months_paid = sub.calc_months_paid,
  earned_amount = ROUND((sub.calc_months_paid::numeric / sub.adv_months::numeric) * c.amount, 2),
  unearned_amount = ROUND(c.amount - ((sub.calc_months_paid::numeric / sub.adv_months::numeric) * c.amount), 2),
  updated_at = NOW()
FROM (
  SELECT
    c2.id AS commission_id,
    COALESCE(c2.advance_months, 9) AS adv_months,
    LEAST(
      COALESCE(c2.advance_months, 9),
      GREATEST(
        0,
        EXTRACT(MONTH FROM AGE(
          CASE
            WHEN p.lifecycle_status IN ('cancelled', 'lapsed') AND p.cancellation_date IS NOT NULL
              THEN p.cancellation_date::timestamp
            ELSE NOW()
          END,
          p.effective_date::timestamp
        ))::int
        + EXTRACT(YEAR FROM AGE(
          CASE
            WHEN p.lifecycle_status IN ('cancelled', 'lapsed') AND p.cancellation_date IS NOT NULL
              THEN p.cancellation_date::timestamp
            ELSE NOW()
          END,
          p.effective_date::timestamp
        ))::int * 12
      )
    ) AS calc_months_paid
  FROM commissions c2
  JOIN policies p ON p.id = c2.policy_id
  WHERE c2.policy_id IS NOT NULL
    AND c2.status NOT IN ('charged_back', 'reversed', 'clawback')
) sub
WHERE c.id = sub.commission_id
  AND sub.adv_months > 0;
