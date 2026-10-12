"use client";

import { useEffect } from "react";
import { UpdateAvailableToast } from "@/components/UpdateAvailableToast";

/**
 * 根布局客户端壳：启动后延迟触发一次更新检查（待界面就绪），并挂载全局更新提示。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;
    const timer = window.setTimeout(() => {
      void window.electronAPI.invoke("updater:check").catch(() => {});
    }, 1600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {children}
      <UpdateAvailableToast />
    </>
  );
}
