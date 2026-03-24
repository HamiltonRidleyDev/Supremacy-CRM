"use client";

import { useState, useEffect } from "react";
import { QuickStartOverlay } from "./QuickStartOverlay";
import { useIsMobile } from "@/hooks/useIsMobile";

const LS_KEY = "supremacy_quick_start";

export function QuickStartWrapper() {
  const { isMobile, isReady } = useIsMobile();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isReady) return;

    // Desktop: never show Quick Start overlay
    if (!isMobile) {
      setChecked(true);
      return;
    }

    // Mobile: show by default unless user explicitly opted out
    const optedOut = localStorage.getItem(LS_KEY) === "false";
    if (!optedOut) setShow(true);
    setChecked(true);

    // Sync preference from server in background
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((prefs) => {
        if (typeof prefs.quickStart === "boolean") {
          localStorage.setItem(LS_KEY, String(prefs.quickStart));
        }
      })
      .catch(() => {});
  }, [isReady, isMobile]);

  if (!checked || !show) return null;

  return <QuickStartOverlay onClose={() => setShow(false)} />;
}
