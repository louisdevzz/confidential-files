import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Shield, Users, Search, Clock, FlaskConical, Calculator, Zap, Leaf } from "lucide-react";

const subjectIcons: Record<string, string> = {
  math: "🧮",
  physics: "⚡",
  chemistry: "🧪",
  biology: "🧬",
};

const diffLabels: Record<string, { label: string; color: string }> = {
  easy: { label: "Dễ", color: "text-green-400" },
  medium: { label: "TB", color: "text-accent" },
  hard: { label: "Khó", color: "text-primary" },
};

// Mock available rooms
const mockRooms = [
  { code: "ABC123", host: "Sherlock", players: 2, max: 4, subjects: ["chemistry", "physics"], difficulty: "medium" },
  { code: "XYZ789", host: "Conan", players: 1, max: 3, subjects: ["math"], difficulty: "easy" },
  { code: "QWE456", host: "Holmes", players: 3, max: 5, subjects: ["biology", "chemistry"], difficulty: "hard" },
];

const JoinRoom = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");

  const handleJoinByCode = () => {
    if (roomCode.trim() && nickname.trim()) {
      navigate(`/lobby/${roomCode.toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 font-body"
        >
          <ArrowLeft className="w-5 h-5" />
          Quay lại
        </button>
      </header>

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
                disabled={!roomCode.trim() || !nickname.trim()}
                className={`px-6 py-3 rounded-xl font-display text-lg flex items-center gap-2 transition-all ${
                  roomCode.trim() && nickname.trim()
                    ? "bg-danger-gradient text-foreground shadow-red hover:scale-[1.02]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                VÀO
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Room list */}
          <div>
            <h2 className="text-xl font-display text-foreground text-glow-gold mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-accent" />
              PHÒNG ĐANG CHỜ
            </h2>

            <div className="space-y-3">
              {mockRooms.map((room, i) => (
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
                      <span className="text-muted-foreground font-body text-sm">bởi {room.host}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground font-body flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {room.players}/{room.max}
                      </span>
                      <span className="flex gap-1">
                        {room.subjects.map((s) => (
                          <span key={s} title={s}>{subjectIcons[s]}</span>
                        ))}
                      </span>
                      <span className={`font-body font-bold text-xs ${diffLabels[room.difficulty].color}`}>
                        {diffLabels[room.difficulty].label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => nickname.trim() && navigate(`/lobby/${room.code}`)}
                    disabled={!nickname.trim()}
                    className={`px-5 py-2 rounded-lg font-display text-sm transition-all ${
                      nickname.trim()
                        ? "bg-secondary/30 mystery-border text-secondary hover:bg-secondary/50"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    THAM GIA
                  </button>
                </motion.div>
              ))}
            </div>

            {mockRooms.length === 0 && (
              <div className="text-center text-muted-foreground font-body py-12">
                <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                Chưa có phòng nào đang chờ...
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default JoinRoom;
