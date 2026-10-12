export type DesktopNotifyKind = "copy" | "save" | "generic";

/**
 * 通过主进程显示系统通知（尊重设置中的通知开关）
 */
export async function showDesktopNotification(payload: {
  title: string;
  body?: string;
  kind: DesktopNotifyKind;
}): Promise<void> {
  try {
    if (typeof window === "undefined" || !window.electronAPI) return;
    await window.electronAPI.invoke("app:showNotification", payload);
  } catch {
    // 通知失败不影响主流程
  }
}
