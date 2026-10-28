import { useStoreSettings } from '@/api/hooks/store';

export function AnnouncementBar() {
  const { data } = useStoreSettings();
  if (!data?.announcement_enabled || !data.announcement_text) return null;
  return (
    <div className="bg-burgundy-800 text-cream-50">
      <p className="container-page py-2 text-center text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-cream-100">
        {data.announcement_text}
      </p>
    </div>
  );
}
