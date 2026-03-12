import { apiHandler } from "@/lib/api-handler";
import { getCurriculumCoverage } from "@/lib/queries";

export const GET = apiHandler(() => getCurriculumCoverage(), { minRole: "manager" });
