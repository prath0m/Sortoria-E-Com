import { useColorTheme } from '@/lib/theme';

/** Admin dark mode follows the OS until the person picks; the storefront keeps its own choice. */
export const useAdminTheme = () => useColorTheme('admin', 'system');
