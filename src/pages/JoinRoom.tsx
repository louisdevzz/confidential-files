import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Users, Search, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchWaitingRooms, joinRoom } from "@/lib/roomService";
import type { Room } from "@/lib/database.types";

const diffLabels: Record<string, { label: string; color: string }> = {
  easy: { label: "Dễ", color: "text-green-400" },
  medium: { label: "TB", color: "text-accent" },
  hard: { label: "Khó", color: "text-primary" },
};

const JoinRoom = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState(profile?.username ?? "");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchWaitingRooms().then((data) => { setRooms(data); setLoadingRooms(false); });
  }, []);

  const handleJoin = async (code: string) => {
    if (!user) { navigate("/"); return; }
    setJoiningCode(code);
    setErrorMsg("");
    const { room, error } = await joinRoom({ code, userId: user.id, nickname: nickname.trim() });
    setJoiningCode(null);
    if (error) { setErrorMsg(error); return; }
    navigate(`/lobby/${room!.code}`);
  };

  const handleJoinByCode = () => {
    if (roomCode.trim() && nickname.trim()) handleJoin(roomCode.trim());
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-display text-foreground text-glow-purple text-center mb-8">
            🚪 VÀO PHÒNG ĐIỀU TRA
          </h1>

          {/* Nickname */}
          <div className="mb-6">
            <label className="block text-sm font-body font-bold text-muted-foreground mb-2">
              <Shield className="w-4 h-4 inline mr-1" />
              Biệt danh Thám tử
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nhập biệt danh..."
              maxLength={20}
              className="w-full bg-input border border-border rounded-xl px-4 py-3 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-mystery-glow/50"
            />
          </div>

          {/* Join by code */}
          <div className="bg-card mystery-border rounded-2xl p-6 shadow-neon mb-8">
            <h2 className="text-xl font-display text-foreground mb-4">📝 NHẬP MÃ PHÒNG</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="VD: ABC123"
                maxLength={6}
                className="flex-1 bg-input border border-border rounded-xl px-4 py-3 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-mystery-glow/50 uppercase tracking-widest text-center text-lg"
              />
              <button
                onClick={handleJoinByCode}
                disabled={!roomCode.trim() || !nickname.trim() || !!joiningCode}
                className={`px-6 py-3 rounded-xl font-display text-lg flex items-center gap-2 transition-all ${
                  roomCode.trim() && nickname.trim() && !joiningCode
                    ? "bg-danger-gradient text-foreground shadow-red hover:scale-[1.02]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {joiningCode === roomCode ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                VÀO
              </button>
            </div>
          </div>

          {/* Room list */}
          <div>
            <h2 className="text-xl font-display text-foreground text-glow-gold mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-accent" />
              PHÒNG ĐANG CHỜ
            </h2>

            {errorMsg && (
              <p className="text-primary text-sm font-body mb-3">{errorMsg}</p>
            )}

            {loadingRooms ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((room, i) => (
                  <motion.div
                    key={room.code}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-card mystery-border rounded-xl p-4 flex items-center justify-between hover:shadow-neon transition-shadow group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-display text-lg text-foreground">{room.code}</span>
                        <span className="text-muted-foreground font-body text-sm">
                          bởi {room.host?.username ?? "Ẩn danh"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground font-body flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {room.member_count ?? 0}/{room.max_players}
                        </span>
                        <span className={`font-body font-bold text-xs ${diffLabels[room.difficulty].color}`}>
                          {diffLabels[room.difficulty].label}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoin(room.code)}
                      disabled={!nickname.trim() || !!joiningCode}
                      className={`px-5 py-2 rounded-lg font-display text-sm transition-all ${
                        nickname.trim() && !joiningCode
                          ? "bg-secondary/30 mystery-border text-secondary hover:bg-secondary/50"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      {joiningCode === room.code ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : "THAM GIA"}
                    </button>
                  </motion.div>
                ))}

                {rooms.length === 0 && (
                  <div className="text-center text-muted-foreground font-body py-12">
                    <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    Chưa có phòng nào đang chờ...
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default JoinRoom;
