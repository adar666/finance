/**
 * PostgREST embed for transactions. `transactions` has two FKs to `accounts`
 * (account_id, transfer_to_account_id), so `accounts(*)` must be disambiguated.
 *
 * @see https://postgrest.org/en/stable/references/api/resource_embedding.html#disambiguation
 */
export const TRANSACTION_LIST_SELECT =
  '*,account:accounts!transactions_account_id_fkey(*),transfer_account:accounts!transactions_transfer_to_account_id_fkey(*),category:categories(*)'
