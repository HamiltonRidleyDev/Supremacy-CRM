"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface TourStep {
  title: string;
  body: string;
  page?: string;    // Navigate to this page when step activates
  highlight?: string; // CSS selector to highlight (optional)
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Supremacy BJJ",
    body: "This quick tour will show you the key areas of the app. You can always re-launch this tour from the ? button in the sidebar.",
  },
  {
    title: "Daily Briefing",
    body: "Start your day here. One screen shows who needs attention, new leads to follow up, unread messages, and pending tasks. No digging required.",
    page: "/briefing",
  },
  {
    title: "Dashboard — Attention Tab",
    body: "Your business command center. The default 'Attention' tab shows at-risk members and revenue in danger. Other tabs have KPIs, insights, win-back tools, and more.",
    page: "/?tab=attention",
  },
  {
    title: "Students",
    body: "Your full roster with engagement scores, risk levels, cost-per-class, and attendance. Sort by any column. Use the 'At Risk' and 'Ghost' filters to focus on members who need outreach.",
    page: "/students",
  },
  {
    title: "Student Detail",
    body: "Click any student to see their full profile: engagement breakdown, attendance trends, conversation history, household members, and knowledge map. Everything you need before picking up the phone.",
  },
  {
    title: "Mat Planner",
    body: "Talk through your lesson ideas and the AI helps structure them. It learns your teaching style, stories, and philosophy over time — so the more you use it, the better it gets.",
    page: "/planner",
  },
  {
    title: "Content Studio",
    body: "Generate social posts, blog content, emails, and more in your authentic voice. The AI uses everything it's learned about your teaching style. Review, revise conversationally, then approve.",
    page: "/content",
  },
  {
    title: "Leads / CRM",
    body: "Track every prospect from first contact through sign-up. Pipeline view, table view, and a conversion funnel that shows monthly drop-off rates.",
    page: "/leads",
  },
  {
    title: "Getting Started Guide",
    body: "For a deeper walkthrough organized by what you're trying to accomplish (reduce churn, generate leads, build curriculum), plus a metric glossary — check out the Getting Started page anytime.",
    page: "/getting-started",
  },
  {
    title: "You're All Set!",
    body: "That's the overview. Explore at your own pace — every metric has an info tooltip (hover the (i) icons) and empty sections include setup guidance. You can re-launch this tour anytime from the ? button.",
  },
];

const STORAGE_KEY = "supremacy_tour_completed";

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(-1); // -1 = not active
  const [hasCompleted, setHasCompleted] = useState(true); // default true to prevent flash

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setHasCompleted(false);
      // Auto-start on first visit after a short delay
      const timer = setTimeout(() => setStep(0), 800);
      return () => clearTimeout(timer);
    }
    setHasCompleted(true);
  }, []);

  const closeTour = useCallback(() => {
    setStep(-1);
    localStorage.setItem(STORAGE_KEY, "true");
    setHasCompleted(true);
  }, []);

  const nextStep = useCallback(() => {
    const next = step + 1;
    if (next >= TOUR_STEPS.length) {
      closeTour();
      return;
    }
    setStep(next);
    const nextStepData = TOUR_STEPS[next];
    if (nextStepData.page && nextStepData.page !== pathname) {
      router.push(nextStepData.page);
    }
  }, [step, closeTour, router, pathname]);

  const prevStep = useCallback(() => {
    const prev = step - 1;
    if (prev < 0) return;
    setStep(prev);
    const prevStepData = TOUR_STEPS[prev];
    if (prevStepData.page && prevStepData.page !== pathname) {
      router.push(prevStepData.page);
    }
  }, [step, router, pathname]);

  const restartTour = useCallback(() => {
    setStep(0);
    const firstPage = TOUR_STEPS[0].page;
    if (firstPage && firstPage !== pathname) {
      router.push(firstPage);
    }
  }, [router, pathname]);

  const isActive = step >= 0;
  const currentStep = isActive ? TOUR_STEPS[step] : null;

  return (
    <>
      {/* Tour overlay + modal */}
      {isActive && currentStep && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-[9998]"
            onClick={closeTour}
          />

          {/* Tour card — centered */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
            <div className="bg-[#1a2332] border border-[#2a3a4a] rounded-2xl shadow-2xl max-w-md w-full mx-4 pointer-events-auto">
              {/* Progress bar */}
              <div className="h-1 bg-[#0c1929] rounded-t-2xl overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
                />
              </div>

              <div className="p-6">
                {/* Step counter */}
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2">
                  Step {step + 1} of {TOUR_STEPS.length}
                </p>

                <h3 className="text-lg font-bold mb-2">{currentStep.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{currentStep.body}</p>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6">
                  <button
                    onClick={closeTour}
                    className="text-xs text-muted hover:text-foreground transition-colors"
                  >
                    Skip tour
                  </button>

                  <div className="flex gap-2">
                    {step > 0 && (
                      <button
                        onClick={prevStep}
                        className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                      >
                        Back
                      </button>
                    )}
                    <button
                      onClick={nextStep}
                      className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                    >
                      {step === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Re-launch button (always visible once tour has been completed) */}
      {!isActive && hasCompleted && (
        <button
          onClick={restartTour}
          className="fixed bottom-20 md:bottom-4 right-14 md:right-4 z-50 w-9 h-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted hover:text-accent hover:border-accent/40 transition-colors"
          title="Restart tour"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </button>
      )}
    </>
  );
}
