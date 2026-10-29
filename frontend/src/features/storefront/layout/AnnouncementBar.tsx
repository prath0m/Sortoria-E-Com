import { useStoreSettings } from '@/api/hooks/store';

export function AnnouncementBar() {
  const { data } = useStoreSettings();
  if (!data?.announcement_enabled || !data.announcement_text) return null;
  return (
    <div className="bg-[#0a0a0a] text-white">
      <p className="container-page py-2 text-center text-xs font-medium text-white/85">
        {data.announcement_text}
      </p>
    </div>
  );
}
