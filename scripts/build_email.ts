/** Invoked by the native bridge with a filtered local environment. */
import { buildEmail, emailContext, readEmailPlan } from '../lib/native-email';
async function main() {
  const [action, workspace, plan] = process.argv.slice(2);
  if (!workspace) throw new Error('Supply a private email workspace');
  if (action === 'context') return emailContext(workspace);
  if (action === 'build' && plan) return buildEmail(workspace, await readEmailPlan(workspace, plan));
  throw new Error('Use context <workspace> or build <workspace> <plan>');
}
main().then(result => console.log(JSON.stringify(result))).catch(() => {
  console.error('Native email draft held: check explicit policy, source hashes/citations, wording and private paths. No source or credential values are logged.'); process.exitCode = 1;
});
