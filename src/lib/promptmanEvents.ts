import type { SettingsNavSection } from "@/components/Settings";


export const PROMPTMAN_OPEN_SETTINGS_EVENT = "promptman:open-settings" as const;

export type PromptmanOpenSettingsDetail = {
  section?: SettingsNavSection;
};
