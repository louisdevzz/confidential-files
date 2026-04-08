import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Users, RefreshCw, Sparkles, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchWaitingRooms, joinRoom } from "@/lib/roomService";
import type { Room } from "@/lib/database.types";

const diffConfig: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: "Dễ", color: "text-green-400", bg: "bg-green-400/10 border-green-400/30" },
  medium: { label: "TB", color: "text-accent", bg: "bg-accent/10 border-accent/30" },
  hard: { label: "Khó", color: "text-primary", bg: "bg-primary/10 border-primary/30" },
};

const RoomList = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadRooms = async () => {
    setLoading(true);
    const data = await fetchWaitingRooms();
    setRooms(data);
    setLoading(false);
  };

  useEffect(() => { loadRooms(); }, []);

  const handleJoin = async (code: string) => {
    if (!user) { navigate("/"); return; }
    const nickname = profile?.username ?? "Thám Tử";
    setJoiningCode(code);
    setErrorMsg("");
    const { room, error } = await joinRoom({ code, userId: user.id, nickname });
    setJoiningCode(null);
    if (error) { setErrorMsg(error); return; }
    navigate(`/lobby/${room!.code}`);
  };

  const filteredRooms = rooms;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Title */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-display text-foreground text-glow-gold">
                🚪 PHÒNG ĐANG CHỜ
              </h1>
              <p className="text-muted-foreground font-body text-sm mt-1">
                {rooms.length} phòng đang mở — tham gia ngay!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadRooms}
                disabled={loading}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Làm mới"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
              {user && (
                <button
                  onClick={() => navigate("/create")}
                  className="flex items-center gap-1.5 bg-danger-gradient px-4 py-2 rounded-lg font-display text-sm text-foreground shadow-red hover:scale-105 transition-transform"
                >
                  <Sparkles className="w-4 h-4" />
                  Tạo Phòng
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4 text-primary font-body text-sm">
              {errorMsg}
            </div>
          )}

          {/* Room list */}
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRooms.length > 0 ? (
            <div className="space-y-3">
              {filteredRooms.map((room, i) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card mystery-border rounded-xl p-4 hover:shadow-neon transition-shadow"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Room code + host */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-display text-xl text-foreground tracking-widest">{room.code}</span>
                        <div className="flex items-center gap-1.5">
                          {room.host?.avatar_url ? (
                          <img src={room.host.avatar_url} alt="" referrerPolicy="no-referrer" className="w-5 h-5 rounded-full" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-secondary/30 flex items-center justify-center text-xs text-secondary font-display">
                              {(room.host?.username ?? "?")[0]}
                            </div>
                          )}
                          <span className="text-muted-foreground font-body text-sm truncate">
                            {room.host?.username ?? "Ẩn danh"}
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-muted-foreground font-body text-sm">
                          <Users className="w-3.5 h-3.5" />
                          {room.member_count ?? 0}/{room.max_players} thám tử
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border font-body font-bold text-xs ${diffConfig[room.difficulty].color} ${diffConfig[room.difficulty].bg}`}>
                          {diffConfig[room.difficulty].label}
                        </span>
                      </div>
                    </div>

                    {/* Join button */}
                    <button
                      onClick={() => handleJoin(room.code)}
                      disabled={!user || !!joiningCode || (room.member_count ?? 0) >= room.max_players}
                      className={`shrink-0 px-5 py-2.5 rounded-xl font-display text-sm transition-all ${
                        user && !joiningCode && (room.member_count ?? 0) < room.max_players
                          ? "bg-secondary/30 mystery-border text-secondary hover:bg-secondary/50 hover:scale-105"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      {joiningCode === room.code ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (room.member_count ?? 0) >= room.max_players ? "ĐẦY" : "THAM GIA"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground font-body text-lg mb-2">
                Chưa có phòng nào đang chờ
              </p>
              {user && (
                <button
                  onClick={() => navigate("/create")}
                  className="mt-4 inline-flex items-center gap-2 bg-danger-gradient px-6 py-3 rounded-xl font-display text-foreground shadow-red hover:scale-105 transition-transform"
                >
                  <Sparkles className="w-4 h-4" />
                  Tạo Phòng Đầu Tiên
                </button>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default RoomList;
