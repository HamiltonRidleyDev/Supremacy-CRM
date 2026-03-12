import { apiHandler } from "@/lib/api-handler";
import { getStudents } from "@/lib/queries";

export const GET = apiHandler(() => getStudents());
