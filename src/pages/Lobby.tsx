import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Users, Crown, Clock, Sparkles, Loader2, Play, Wand2, LogOut } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchRoomWithMembers, startGame, leaveRoom } from "@/lib/roomService";
import { generateCase } from "@/lib/geminiClient";
import { supabase } from "@/lib/supabase";
import type { Room, RoomMember } from "@/lib/database.types";

const Lobby = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startingLabel, setStartingLabel] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    if (!code) return;
    const result = await fetchRoomWithMembers(code);
    if (result.room) {
      setRoom(result.room);
      setMembers(result.members);
      if (result.room.status === "playing") navigate(`/game/${code}`, { replace: true });
    }
    setLoading(false);
  }, [code, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Cleanup: remove member when user closes tab or navigates away
  useEffect(() => {
    if (!code || !user?.id || !room?.id) return;
    const roomId = room.id;
    const userId = user.id;
    // Cache auth token eagerly (beforeunload is sync, can't await)
    let cachedToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) cachedToken = session.access_token;
    });
    const cleanup = () => {
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/room_members?room_id=eq.${roomId}&user_id=eq.${userId}`,
        {
          method: "DELETE",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${cachedToken}`,
            Prefer: "return=minimal",
          },
          keepalive: true,
        }
      );
    };
    window.addEventListener("beforeunload", cleanup);
    return () => window.removeEventListener("beforeunload", cleanup);
  }, [code, user?.id, room?.id]);

  const handleLeave = async () => {
    if (!code || !user?.id || leaving) return;
    setLeaving(true);
    await leaveRoom({ roomCode: code, userId: user.id });
    navigate("/");
  };

  // Real-time: watch room status (redirect all players when host starts)
  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`lobby:${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        (payload) => {
          const updated = payload.new as Room;
          if (updated.status === "playing") navigate(`/game/${code}`, { replace: true });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [code, navigate, load]);

  const copyCode = () => {
    navigator.clipboard.writeText(code ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStart = async () => {
    if (!code || !room) return;
    setStarting(true);
    setError("");

    // Tầng 1: Sinh vụ án qua Edge Function (cũng lưu vào DB, không cần saveCaseToRoom)
    setStartingLabel("Đang dựng vụ án...");
    try {
      await generateCase(room.difficulty, code);
    } catch (e) {
      setError(`Không thể tạo vụ án: ${(e as Error).message}`);
      setStarting(false);
      setStartingLabel("");
      return;
    }

    setStartingLabel("Đang khởi động phòng...");
    const { error: err } = await startGame(code);
    if (err) { setError(err); setStarting(false); setStartingLabel(""); return; }
    navigate(`/game/${code}`, { replace: true });
  };

  const isHost = room?.host_id === user?.id;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Không tìm thấy phòng.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-card mystery-border rounded-2xl p-8 shadow-neon text-center">
            <h1 className="text-2xl font-display text-foreground text-glow-purple mb-2">
              🕵️ PHÒNG ĐIỀU TRA
            </h1>

            {/* Room Code */}
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-2 bg-muted/50 mystery-border rounded-xl px-6 py-3 mb-6 hover:bg-muted transition-colors"
            >
              <span className="font-display text-2xl text-accent tracking-widest">{code}</span>
              <Copy className="w-4 h-4 text-muted-foreground" />
              {copied && <span className="text-xs text-green-400 font-body">Đã copy!</span>}
            </button>

            {/* Room info badges */}
            <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
              <span className="text-xs font-body bg-accent/10 text-accent border border-accent/20 rounded-full px-3 py-1">
                {room.difficulty === "easy" ? "Dễ" : room.difficulty === "medium" ? "Trung Bình" : "Khó"}
              </span>
            </div>

            {/* Players */}
            <div className="mb-6">
              <h2 className="text-sm font-body font-bold text-muted-foreground mb-3 flex items-center justify-center gap-1">
                <Users className="w-4 h-4" />
                Thám tử trong phòng ({members.length}/{room.max_players})
              </h2>
              <div className="space-y-2">
                {members.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-secondary/30 flex items-center justify-center text-secondary font-display text-sm">
                        {m.nickname?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <span className="font-body font-bold text-foreground">{m.nickname}</span>
                      {m.user_id === user?.id && (
                        <span className="text-xs text-muted-foreground font-body">(bạn)</span>
                      )}
                    </div>
                    {m.is_host && <Crown className="w-4 h-4 text-accent" />}
                  </motion.div>
                ))}

                {/* Empty slots */}
                {[...Array(Math.max(0, room.max_players - members.length))].map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 border border-dashed border-border"
                  >
                    <div className="w-8 h-8 rounded-full border border-dashed border-border flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground animate-pulse-glow" />
                    </div>
                    <span className="text-muted-foreground font-body text-sm">Đang chờ...</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm font-body mb-3">{error}</p>
            )}

            {/* Start / Wait button */}
            {isHost ? (
              <button
                onClick={handleStart}
                disabled={starting}
                className="w-full bg-danger-gradient px-6 py-4 rounded-xl font-display text-xl text-foreground shadow-red hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-base">{startingLabel || "Đang xử lý..."}</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    TẠO VỤ ÁN &amp; BẮT ĐẦU
                  </>
                )}
              </button>
            ) : (
              <div className="w-full bg-muted/30 border border-border px-6 py-4 rounded-xl font-body text-muted-foreground flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 animate-pulse-glow" />
                Đang chờ host bắt đầu...
              </div>
            )}

            {/* Leave button */}
            <button
              onClick={handleLeave}
              disabled={leaving || starting}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-muted/30 border border-border rounded-xl px-4 py-3 font-body text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Rời phòng
            </button>

            <p className="text-muted-foreground text-xs font-body mt-4">
              {isHost ? "Bạn có thể bắt đầu bất cứ lúc nào — không cần chờ đủ người 🔍" : "Chia sẻ mã phòng cho bạn bè để cùng tham gia 🔍"}
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Lobby;

