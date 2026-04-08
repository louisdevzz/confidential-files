import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Trophy, Home, RotateCcw, Loader2, Eye,
  ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { chatWithSuspect } from "@/lib/geminiClient";
import {
  fetchRoomWithMembers, fetchGameMessages, insertGameMessage,
} from "@/lib/roomService";
import type { Room, SafeGeneratedCase, GameMessage, RoomMember } from "@/lib/database.types";
import type { ChatTurn } from "@/lib/geminiClient";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Phase = "calm" | "nervous" | "cornered";

const phaseFromCount = (aiCount: number): Phase =>
  aiCount >= 10 ? "cornered" : aiCount >= 4 ? "nervous" : "calm";

const suspicionFromCount = (aiCount: number, won: boolean): number =>
  won ? 100 : Math.min(95, aiCount * 9);

// Build Gemini chat history from shared messages
const buildHistory = (messages: GameMessage[]): ChatTurn[] =>
  messages
    .filter((m) => m.role === "ai" || m.role === "user")
    .slice(-14)
    .map((m) => ({
      role: (m.role === "ai" ? "assistant" : "user") as ChatTurn["role"],
      content: m.content.replace("[GAME_OVER]", "").trim(),
    }))
    .filter((m) => m.content.length > 0);

type ProfileTotals = {
  total_wins?: number | null;
  total_games?: number | null;
};

const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

const Game = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [caseData, setCaseData] = useState<SafeGeneratedCase | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [won, setWon] = useState(false);
  const [mvp, setMvp] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [caseOpen, setCaseOpen] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Dedup: tracks content keys we inserted optimistically so we skip realtime echo
  const optimisticKeys = useRef(new Set<string>());
  // Track who sent the last user message (for MVP detection by other players)
  const lastSenderRef = useRef<string | null>(null);

  // ── Load room + case ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    (async () => {
      const { room: r, members: m } = await fetchRoomWithMembers(code);
      if (!r) { setLoadError("Không tìm thấy phòng."); return; }
      setRoom(r);
      setMembers(m);
      if (r.case_data) setCaseData(r.case_data as SafeGeneratedCase);
      else setLoadError("Vụ án chưa được khởi tạo. Hãy quay lại phòng chờ.");
    })();
  }, [code]);

  // ── Load existing messages ──────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    fetchGameMessages(code).then(setMessages);
  }, [code]);

  // ── Realtime: new messages ──────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`game-msgs:${code}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_messages", filter: `room_code=eq.${code}` },
        (payload) => {
          const msg = payload.new as GameMessage;
          const key = `${msg.role}:${msg.content.slice(0, 60)}`;
          if (optimisticKeys.current.has(key)) {
            optimisticKeys.current.delete(key);
            return; // already shown optimistically
          }
          setMessages((prev) => [...prev, msg]);
          if (msg.role === "user") lastSenderRef.current = msg.sender_nickname;
          if (msg.role === "ai" && msg.content.includes("[GAME_OVER]")) {
            triggerWin(lastSenderRef.current ?? "Thám tử", false);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  // Auto-grow composer height up to a readable limit
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  }, [input]);

  // ── Win logic ───────────────────────────────────────────────────────────────
  const triggerWin = useCallback(
    async (mvpName: string, isCurrentUser: boolean) => {
      if (won) return;
      setWon(true);
      setMvp(mvpName);
      if (!code) return;
      await db.from("rooms").update({ status: "finished" }).eq("code", code);
      if (user?.id && isCurrentUser) {
        const { data: rawProfile } = await db
          .from("profiles")
          .select("total_wins, total_games")
          .eq("id", user.id)
          .single();
        const profile = rawProfile as ProfileTotals | null;
        if (profile) {
          await db.from("profiles").update({
            total_wins: (profile.total_wins ?? 0) + 1,
            total_games: (profile.total_games ?? 0) + 1,
          }).eq("id", user.id);
        }
      } else if (user?.id) {
        const { data: rawProfile } = await db.from("profiles").select("total_games").eq("id", user.id).single();
        const profile = rawProfile as ProfileTotals | null;
        if (profile) {
          await db.from("profiles").update({
            total_games: (profile.total_games ?? 0) + 1,
          }).eq("id", user.id);
        }
      }
    },
    [won, code, user?.id]
  );

  // ── Send message ────────────────────────────────────────────────────────────
  const myNickname =
    members.find((m) => m.user_id === user?.id)?.nickname ?? user?.email ?? "Thám tử";

  const sendMessage = async () => {
    if (!input.trim() || isSending || isAiTyping || won || !caseData || !code) return;
    const text = input.trim();
    setInput("");
    setIsSending(true);

    // Optimistic user message
    const tempUser: GameMessage = {
      id: `opt-u-${Date.now()}`, room_code: code, role: "user",
      sender_nickname: myNickname, content: text,
      created_at: new Date().toISOString(),
    };
    const userKey = `user:${text.slice(0, 60)}`;
    optimisticKeys.current.add(userKey);
    setMessages((prev) => [...prev, tempUser]);
    lastSenderRef.current = myNickname;

    // Persist user message
    await insertGameMessage(code, "user", myNickname, text);

    // Call Gemini Tầng 2
    setIsSending(false);
    setIsAiTyping(true);
    let aiResponse = "";
    try {
      aiResponse = await chatWithSuspect(buildHistory([...messages, tempUser]), code);
    } catch (e) {
      aiResponse = `(Lỗi kết nối AI: ${(e as Error).message.slice(0, 100)})`;
    }
    setIsAiTyping(false);

    // Optimistic AI message
    const tempAi: GameMessage = {
      id: `opt-a-${Date.now()}`, room_code: code, role: "ai",
      sender_nickname: caseData.ten_hung_thu, content: aiResponse,
      created_at: new Date().toISOString(),
    };
    const aiKey = `ai:${aiResponse.slice(0, 60)}`;
    optimisticKeys.current.add(aiKey);
    setMessages((prev) => [...prev, tempAi]);

    // Persist AI message
    await insertGameMessage(code, "ai", caseData.ten_hung_thu, aiResponse);

    // Check win
    if (aiResponse.includes("[GAME_OVER]")) {
      await triggerWin(myNickname, true);
    }

    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const aiMsgCount = messages.filter((m) => m.role === "ai").length;
  const suspicion = suspicionFromCount(aiMsgCount, won);
  const phase = phaseFromCount(aiMsgCount);
  const phaseLabel = phase === "calm" ? "Bình thản · Tự tin" : phase === "nervous" ? "Bắt đầu lo lắng" : "Sắp vỡ trận";

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-foreground font-body">{loadError}</p>
          <button onClick={() => navigate(-1)} className="text-primary text-sm underline">Quay lại</button>
        </div>
      </div>
    );
  }

  if (!room || !caseData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-body text-sm">Đang tải vụ án...</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Victory overlay ── */}
      <AnimatePresence>
        {won && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-card mystery-border rounded-2xl p-8 max-w-sm w-full text-center shadow-neon"
            >
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="font-display text-2xl text-accent text-glow-purple mb-2">PHÁ ÁN THÀNH CÔNG!</h2>
              <p className="font-body text-muted-foreground text-sm mb-2">
                <span className="text-foreground font-bold">{mvp}</span> đã vạch trần{" "}
                <span className="text-primary font-bold">{caseData.ten_hung_thu}</span>!
              </p>
              <div className="bg-muted/30 rounded-lg p-3 mb-5 text-left">
                <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">Kiến thức đúng</p>
                <p className="text-sm text-foreground font-body leading-relaxed">{caseData.kien_thuc_an}</p>
              </div>
              <div className="flex items-center justify-center gap-2 mb-5">
                <Trophy className="w-4 h-4 text-accent" />
                <span className="font-body text-sm text-accent">
                  {mvp === myNickname ? "+1 chiến thắng · +1 ván" : "+1 ván (đồng đội)"}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 flex items-center justify-center gap-2 bg-muted/50 border border-border rounded-xl px-4 py-3 font-body text-foreground hover:bg-muted transition-colors"
                >
                  <Home className="w-4 h-4" /> Trang Chủ
                </button>
                <button
                  onClick={() => navigate("/create")}
                  className="flex-1 flex items-center justify-center gap-2 bg-danger-gradient rounded-xl px-4 py-3 font-body font-bold text-foreground hover:scale-[1.02] transition-transform"
                >
                  <RotateCcw className="w-4 h-4" /> Chơi Lại
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col lg:flex-row gap-0 lg:gap-4 p-3 lg:p-6 max-w-6xl mx-auto w-full">
        {/* ── Left: Case File ── */}
        <div className="lg:w-[22rem] flex-shrink-0">
          <div className="bg-card mystery-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setCaseOpen((v) => !v)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors lg:cursor-default"
            >
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <span className="font-display text-sm text-foreground text-glow-purple">HỒ SƠ VỤ ÁN</span>
              </div>
              <span className="lg:hidden">
                {caseOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {caseOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    <div className="text-center py-3 border-b border-border">
                      <p className="font-display text-foreground text-sm">NGHI PHẠM</p>
                      <p className="font-body font-bold text-primary text-base">{caseData.ten_hung_thu}</p>
                    </div>

                    <div>
                      <p className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1">Bối Cảnh Vụ Án</p>
                      <p className="font-body text-sm text-foreground bg-muted/20 rounded-lg p-3 leading-relaxed border border-border/50">{caseData.boi_canh}</p>
                    </div>

                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                      <p className="font-body text-xs text-primary uppercase tracking-wider mb-1">Lời Khai Ngoại Phạm</p>
                      <p className="font-body text-sm text-foreground italic">"{caseData.loi_khai}"</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right: Shared Chat ── */}
        <div className="flex-1 flex flex-col bg-card mystery-border rounded-2xl overflow-hidden min-h-[60vh] lg:min-h-0">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="w-9 h-9 rounded-full bg-red-900/30 border border-red-500/30 flex items-center justify-center text-lg">🎭</div>
            <div>
              <p className="font-display text-sm text-foreground">{caseData.ten_hung_thu}</p>
              <p className="font-body text-xs text-muted-foreground">{phaseLabel}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${suspicion >= 70 ? "bg-red-500" : suspicion >= 35 ? "bg-amber-400" : "bg-green-500"} animate-pulse`} />
              <span className="font-body text-xs text-muted-foreground">{members.length} thám tử</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 font-body text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary/20 border border-primary/20 text-foreground rounded-br-sm"
                    : "bg-muted/40 border border-border text-foreground rounded-bl-sm"
                }`}>
                  {msg.role === "user" && (
                    <span className="text-xs text-primary/80 font-bold block mb-1">
                      🔍 {msg.sender_nickname}
                    </span>
                  )}
                  {msg.role === "ai" && (
                    <span className="text-xs text-muted-foreground font-bold block mb-1">
                      🎭 {caseData.ten_hung_thu}
                    </span>
                  )}
                  {msg.content.replace("[GAME_OVER]", "").trim()}
                </div>
              </motion.div>
            ))}

            {isAiTyping && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="bg-muted/40 border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{caseData.ten_hung_thu} đang trả lời</span>
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full block"
                        animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </span>
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending || isAiTyping || won}
                  placeholder={won ? "Vụ án đã được phá..." : "Dùng kiến thức để vạch trần lời khai giả..."}
                rows={1}
                className="flex-1 max-h-44 resize-none overflow-y-auto bg-muted/30 border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground leading-6 focus:outline-none focus:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isSending || isAiTyping || won}
                className="w-11 h-11 flex items-center justify-center bg-primary rounded-xl text-foreground hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isSending || isAiTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-muted-foreground font-body">
              Enter để gửi · Shift + Enter để xuống dòng
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Game;
