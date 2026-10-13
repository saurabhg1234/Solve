import { Portal } from '@/components/portal';
import { stagesFor,requirementCount } from '@/lib/engine';
import { workflows } from '@/lib/catalogue';
import { ready } from '@/lib/config';
export const dynamic='force-dynamic';
export default function Page() {
  return <Portal configured={ready().database&&ready().identity} requirementCount={requirementCount} stageCounts={Object.fromEntries(workflows.map(w=>[w.id,stagesFor(w.id).length]))}/>;
}
