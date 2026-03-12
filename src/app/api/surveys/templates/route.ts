import { apiHandler } from "@/lib/api-handler";
import { getSurveyTemplates, createSurveyTemplate } from "@/lib/queries";
import { NextResponse } from "next/server";

export const GET = apiHandler(() => {
  return getSurveyTemplates();
});

export const POST = apiHandler(async (request: Request) => {
  const body = await request.json();
  const { name, slug, description, target_type, questions } = body;
  if (!name || !slug || !questions) {
    return NextResponse.json({ error: "name, slug, and questions are required" }, { status: 400 });
  }
  const result = createSurveyTemplate(
    name, slug, description || "", target_type || "student",
    typeof questions === "string" ? questions : JSON.stringify(questions)
  );
  return { id: Number(result.lastInsertRowid) };
});
