"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Question {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "multi_select";
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

interface SurveyData {
  name: string;
  templateName: string;
  description: string;
  questions: Question[];
  status: string;
  completed: boolean;
}

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/surveys/respond/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSurvey(data);
          if (data.completed) setSubmitted(true);
        }
      })
      .catch(() => setError("Failed to load survey"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || submitting) return;

    // Validate required fields
    const missing = survey.questions.filter(
      (q) => q.required && (!answers[q.key] || answers[q.key].trim() === "")
    );
    if (missing.length > 0) {
      setError(`Please answer: ${missing.map((q) => q.label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/surveys/respond/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin w-8 h-8 border-2 border-[#c73030] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a1a] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-white text-lg font-medium mb-1">Survey Unavailable</p>
          <p className="text-[#888] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#10b981]/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold mb-2">Thank You!</h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Your responses have been saved. This helps us give you a better experience at Supremacy BJJ.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <img src="/logo.png" alt="Supremacy BJJ" width={32} height={32} className="rounded-full" />
            <span className="text-[#c73030] font-bold text-sm tracking-tight">SUPREMACY BJJ</span>
          </div>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/logo.png" alt="Supremacy BJJ" width={40} height={40} className="rounded-full" />
            <span className="text-[#c73030] font-bold tracking-tight">SUPREMACY BJJ</span>
          </div>
          <h1 className="text-white text-xl font-bold mb-1">{survey.templateName}</h1>
          {survey.description && (
            <p className="text-[#888] text-sm">{survey.description}</p>
          )}
          {survey.name && (
            <p className="text-[#555] text-xs mt-2">Hey {survey.name.split(" ")[0]}, this takes about 2 minutes.</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {survey.questions.map((q, i) => (
            <div key={q.key} className="bg-[#111] border border-[#222] rounded-xl p-4">
              <label className="block text-white text-sm font-medium mb-2">
                {q.label}
                {q.required && <span className="text-[#c73030] ml-1">*</span>}
              </label>

              {q.type === "select" && q.options ? (
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        answers[q.key] === opt
                          ? "border-[#c73030] bg-[#c73030]/10 text-white"
                          : "border-[#222] hover:border-[#333] text-[#aaa]"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          answers[q.key] === opt ? "border-[#c73030]" : "border-[#444]"
                        }`}
                      >
                        {answers[q.key] === opt && (
                          <div className="w-2 h-2 rounded-full bg-[#c73030]" />
                        )}
                      </div>
                      <span className="text-sm">{opt}</span>
                      <input
                        type="radio"
                        name={q.key}
                        value={opt}
                        checked={answers[q.key] === opt}
                        onChange={() => setAnswers((a) => ({ ...a, [q.key]: opt }))}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              ) : q.type === "textarea" ? (
                <textarea
                  value={answers[q.key] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  placeholder={q.placeholder || ""}
                  rows={3}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#c73030]/50 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={answers[q.key] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  placeholder={q.placeholder || ""}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#c73030]/50"
                />
              )}

              {/* Progress hint */}
              {i === 0 && survey.questions.length > 5 && (
                <p className="text-[10px] text-[#555] mt-2">
                  Question {i + 1} of {survey.questions.length}
                </p>
              )}
            </div>
          ))}

          {error && (
            <div className="bg-[#c73030]/10 border border-[#c73030]/30 rounded-lg px-4 py-3 text-sm text-[#f87171]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#c73030] hover:bg-[#a82828] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>

          <p className="text-[10px] text-[#444] text-center">
            Your responses help us provide a better training experience.
          </p>
        </form>
      </div>
    </div>
  );
}
