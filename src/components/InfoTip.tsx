"use client";

import { useState, useRef, useEffect } from "react";

interface InfoTipProps {
  text: string;
  wide?: boolean;
}

export default function InfoTip({ text, wide }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-foreground/8 hover:bg-foreground/15 text-muted hover:text-foreground transition-colors flex-shrink-0"
        aria-label="More info"
      >
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 ${
            wide ? "w-72" : "w-56"
          } bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 shadow-xl`}
        >
          <p className="text-[11px] text-[#e2e8f0] leading-relaxed">{text}</p>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 rotate-45 bg-[#1e293b] border-r border-b border-[#334155]" />
          </div>
        </div>
      )}
    </div>
  );
}
