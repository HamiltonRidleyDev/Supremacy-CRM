"use client";

import { useEffect, useState, useRef } from "react";

interface Channel {
  id: number;
  name: string;
  description: string;
  type: string;
  message_count: number;
  unread_count: number;
  role: string;
  last_message: string | null;
  last_message_author: string | null;
  member_count?: number;
}

interface Message {
  id: number;
  content: string;
  is_pinned: number;
  created_at: string;
  parent_id: number | null;
  author_id: number;
  first_name: string;
  last_name: string;
  belt_rank: string;
}

interface Member {
  id: number;
  first_name: string;
  last_name: string;
  belt_rank: string;
  stripes: number;
  role: string;
}

interface ChannelDetail {
  channel: Channel;
  messages: Message[];
  members: Member[];
}

const beltDotColors: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-500",
  purple: "bg-purple-600",
  brown: "bg-amber-700",
  black: "bg-zinc-900",
};

const beltAvatarColors: Record<string, string> = {
  white: "bg-zinc-200 text-black",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-700 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-zinc-800 text-white",
};

const channelIcons: Record<string, string> = {
  public: "#",
  announcement: "!",
  private: "~",
  dm: "@",
};

// For demo, viewing as Dan (student id 1)
const CURRENT_USER_ID = 1;

function formatMessageTime(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = Math.floor(hours / 24);
  if (days < 7) return `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shouldShowDateDivider(messages: Message[], idx: number) {
  if (idx === 0) return true;
  const prev = new Date(messages[idx - 1].created_at).toDateString();
  const curr = new Date(messages[idx].created_at).toDateString();
  return prev !== curr;
}

function formatDividerDate(dt: string) {
  const d = new Date(dt);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function CommunityPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [channelData, setChannelData] = useState<ChannelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/community?studentId=${CURRENT_USER_ID}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setChannels(data);
        if (data.length > 0) setSelectedChannel(data[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    setMsgLoading(true);
    fetch(`/api/community/${selectedChannel}/messages`)
      .then((r) => r.json())
      .then(setChannelData)
      .finally(() => setMsgLoading(false));
  }, [selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelData?.messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChannel || sending) return;
    setSending(true);
    await fetch(`/api/community/${selectedChannel}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorId: CURRENT_USER_ID, content: newMessage.trim() }),
    });
    setNewMessage("");
    // Refresh messages
    const data = await fetch(`/api/community/${selectedChannel}/messages`).then((r) => r.json());
    setChannelData(data);
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const totalUnread = channels.reduce((sum, ch) => sum + (ch.unread_count || 0), 0);
  const currentChannel = channels.find((ch) => ch.id === selectedChannel);
  const isAnnouncement = currentChannel?.type === "announcement";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted animate-pulse">Loading community...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-danger font-medium">Failed to load community</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-accent hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Community</h1>
        <p className="text-sm text-muted mt-1">
          {totalUnread > 0 ? `${totalUnread} unread messages` : "Stay connected with your team"}
        </p>
      </div>

      <div className="flex gap-0 bg-card rounded-xl border border-border overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
        {/* Channel List */}
        <div className="w-64 shrink-0 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-xs text-muted uppercase tracking-wider font-medium px-2">Channels</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  selectedChannel === ch.id
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:text-foreground hover:bg-card-hover"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono opacity-50 w-3 text-center shrink-0">
                      {channelIcons[ch.type] || "#"}
                    </span>
                    <span className={`text-sm truncate ${ch.unread_count > 0 ? "font-semibold text-foreground" : ""}`}>
                      {ch.name}
                    </span>
                  </div>
                  {ch.unread_count > 0 && (
                    <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {ch.unread_count}
                    </span>
                  )}
                </div>
                {ch.last_message && (
                  <p className="text-[11px] text-muted truncate mt-0.5 ml-5">
                    {ch.last_message_author}: {ch.last_message}
                  </p>
                )}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2 px-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${beltAvatarColors["white"]}`}>
                DK
              </div>
              <div>
                <p className="text-xs font-medium">Dan Kemp</p>
                <p className="text-[10px] text-muted">Viewing as you</p>
              </div>
            </div>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel Header */}
          {currentChannel && (
            <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono opacity-50">{channelIcons[currentChannel.type] || "#"}</span>
                  <h2 className="font-semibold">{currentChannel.name}</h2>
                  {isAnnouncement && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning">Announcements</span>
                  )}
                </div>
                <p className="text-xs text-muted">{currentChannel.description}</p>
              </div>
              <button
                onClick={() => setShowMembers(!showMembers)}
                className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                {channelData?.members.length || 0}
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {msgLoading ? (
              <div className="text-muted animate-pulse text-center py-12">Loading messages...</div>
            ) : !channelData?.messages.length ? (
              <div className="text-center py-12">
                <p className="text-muted">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {channelData.messages.map((msg, idx) => {
                  const showDivider = shouldShowDateDivider(channelData.messages, idx);
                  const prevMsg = idx > 0 ? channelData.messages[idx - 1] : null;
                  const isSameAuthor = prevMsg?.author_id === msg.author_id && !showDivider;
                  const timeDiff = prevMsg ? new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() : Infinity;
                  const isGrouped = isSameAuthor && timeDiff < 5 * 60 * 1000; // 5 min grouping

                  return (
                    <div key={msg.id}>
                      {showDivider && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] text-muted font-medium">{formatDividerDate(msg.created_at)}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div className={`flex gap-3 hover:bg-card-hover rounded-lg px-2 py-1 transition-colors ${msg.is_pinned ? "bg-accent/5 border-l-2 border-accent" : ""} ${isGrouped ? "mt-0" : "mt-3"}`}>
                        {!isGrouped ? (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${beltAvatarColors[msg.belt_rank] || beltAvatarColors.white}`}>
                            {msg.first_name[0]}{msg.last_name[0]}
                          </div>
                        ) : (
                          <div className="w-8 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          {!isGrouped && (
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold">{msg.first_name} {msg.last_name}</span>
                              <span className={`w-2 h-2 rounded-full ${beltDotColors[msg.belt_rank] || "bg-zinc-500"}`} />
                              <span className="text-[10px] text-muted">{formatMessageTime(msg.created_at)}</span>
                              {msg.is_pinned === 1 && (
                                <span className="text-[10px] text-accent">pinned</span>
                              )}
                            </div>
                          )}
                          <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="px-5 py-3 border-t border-border shrink-0">
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isAnnouncement ? "Only admins can post here" : `Message #${currentChannel?.name || ""}...`}
                disabled={isAnnouncement}
                className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50 placeholder:text-muted/50 disabled:opacity-40"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending || isAnnouncement}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Members Sidebar */}
        {showMembers && channelData && (
          <div className="w-56 shrink-0 border-l border-border overflow-y-auto">
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted uppercase tracking-wider font-medium">
                Members — {channelData.members.length}
              </p>
            </div>
            <div className="p-2 space-y-1">
              {channelData.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-card-hover transition-colors">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${beltAvatarColors[m.belt_rank] || beltAvatarColors.white}`}>
                    {m.first_name[0]}{m.last_name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{m.first_name} {m.last_name}</p>
                    {m.role === "admin" && (
                      <p className="text-[9px] text-accent">Admin</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
