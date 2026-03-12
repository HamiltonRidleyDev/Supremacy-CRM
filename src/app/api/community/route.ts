import { apiHandler } from "@/lib/api-handler";
import { getChannels } from "@/lib/queries";

export const GET = apiHandler((request) => {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  return getChannels(studentId ? parseInt(studentId) : undefined);
});
