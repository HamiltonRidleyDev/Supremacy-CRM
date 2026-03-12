import { apiHandler } from "@/lib/api-handler";
import { getRecentChatSessions, getChatMessages } from "@/lib/queries";

export const GET = apiHandler((request) => {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (sessionId) {
    const messages = getChatMessages(parseInt(sessionId));
    return { messages };
  }

  const sessions = getRecentChatSessions(20);
  return { sessions };
});
