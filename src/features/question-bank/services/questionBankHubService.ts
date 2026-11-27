import { supabase } from '@/shared/lib/supabase';
import type { QuestionBankHubMode, QuestionBankHubPayload } from '../types/questionBankHub';
import { parseQuestionBankHubPayload } from '../utils/questionBankHubPayload';

/**
 * The hub read.
 *
 * One RPC returns every section the server allows for this student, already
 * ordered. The payload is validated field by field rather than trusted: the
 * generated database types have no entry for the function, so a cast would lie
 * about the shape the moment the function changes.
 */

type HubRpcClient = {
  rpc(
    fn: 'get_question_bank_hub',
    args: { p_mode: string | null }
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

const hubRpc = supabase as unknown as HubRpcClient;

/**
 * `mode` is a request, not a permission: an admission-prep student sending
 * 'hsc' receives admission sections, and the server decides that.
 */
export async function fetchQuestionBankHub(
  mode: QuestionBankHubMode | null
): Promise<QuestionBankHubPayload> {
  const { data, error } = await hubRpc.rpc('get_question_bank_hub', {
    p_mode: mode,
  });

  if (error) throw error;

  return parseQuestionBankHubPayload(data);
}
