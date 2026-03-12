import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import {
  getInstructorInsights,
  getInsightsSummary,
  deactivateInsight,
} from "@/lib/queries";

export const GET = apiHandler(() => {
  const insights = getInstructorInsights();
  const summary = getInsightsSummary();
  return { insights, summary };
}, { minRole: "manager" });

export const DELETE = apiHandler((request) => {
  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  deactivateInsight(id);
  return NextResponse.json({ success: true });
}, { minRole: "manager" });
