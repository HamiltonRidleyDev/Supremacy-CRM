"use client";

import { useState, useEffect } from "react";
import { QuickStartOverlay } from "./QuickStartOverlay";

const LS_KEY = "supremacy_quick_start";

export function QuickStartWrapper() {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Check localStorage synchronously for instant decision
    const enabled = localStorage.getItem(LS_KEY) === "true";
    if (enabled) setShow(true);
    setChecked(true);

    // Sync from server in background (server is source of truth)
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((prefs) => {
        if (typeof prefs.quickStart === "boolean") {
          localStorage.setItem(LS_KEY, String(prefs.quickStart));
          // Only auto-show on initial load, don't re-show if user already dismissed
        }
      })
      .catch(() => {});
  }, []);

  if (!checked || !show) return null;

  return <QuickStartOverlay onClose={() => setShow(false)} />;
}
