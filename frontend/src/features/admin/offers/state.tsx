import { StatusBadge } from '../components/StatusBadge';

export const STATE_FILTER = [
  { value: 'live', label: 'Live' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ended', label: 'Ended' },
  { value: 'inactive', label: 'Switched off' },
];

const LABEL: Record<string, string> = { live: 'Live', scheduled: 'Scheduled', ended: 'Ended', inactive: 'Off' };
const TONE: Record<string, string> = { live: 'active', scheduled: 'confirmed', ended: 'cancelled', inactive: 'inactive' };

export function StateBadge({ state }: { state: string }) {
  return <StatusBadge status={TONE[state] ?? state} label={LABEL[state] ?? state} />;
}
