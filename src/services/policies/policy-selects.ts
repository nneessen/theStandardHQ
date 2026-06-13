// src/services/policies/policy-selects.ts
// Centralized PostgREST select fragments for the policies table.
//
// These were previously copy-pasted (character-for-character) into ~13 separate
// PolicyRepository methods. Keeping them in one place means a column change to
// the client/product/commission joins happens once, not 13 times.

/** The standard client join used by almost every policy read. */
const CLIENT_JOIN = `clients!policies_client_id_fkey (
  id,
  name,
  email,
  phone,
  address,
  date_of_birth,
  state
)`;

/** `*` + full client join. The default projection for hydrated policy reads. */
export const POLICY_WITH_CLIENT = `
  *,
  ${CLIENT_JOIN}
`;

/** Full client join + linked commissions (ROI tracking on lead purchases). */
export const POLICY_WITH_CLIENT_AND_COMMISSIONS = `
  *,
  ${CLIENT_JOIN},
  commissions (
    id,
    amount,
    type
  )
`;

/** `*` + client/carrier NAME-only joins, for hierarchy summaries. */
export const POLICY_WITH_RELATION_NAMES = `
  *,
  client:clients(name),
  carrier:carriers(name)
`;

/** Lightweight client join (id/name/email only) for the unlinked-recent picker. */
export const POLICY_WITH_CLIENT_MINIMAL = `
  *,
  clients!policies_client_id_fkey (
    id,
    name,
    email
  )
`;
