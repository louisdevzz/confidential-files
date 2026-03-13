import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Users, Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createRoom } from "@/lib/roomService";
import type { Difficulty } from "@/lib/database.types";

const difficulties = [
  { id: "easy", label: "Dễ", desc: "Lớp 6-8", color: "text-green-400 border-green-400/30" },
  { id: "medium", label: "Trung Bình", desc: "Lớp 9-10", color: "text-accent border-accent/30" },
  { id: "hard", label: "Khó", desc: "Lớp 11-12", color: "text-primary border-primary/30" },
];

const CreateRoom = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [difficulty, setDifficulty] = useState("medium");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [nickname, setNickname] = useState(profile?.username ?? "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreate = async () => {
    if (!user) { navigate("/"); return; }
    setLoading(true);
    setErrorMsg("");
    const { roomCode, error } = await createRoom({
      hostId: user.id,
      nickname: nickname.trim(),
      difficulty: difficulty as Difficulty,
      maxPlayers,
    });
    setLoading(false);
    if (error) { setErrorMsg(error); return; }
    navigate(`/lobby/${roomCode}`);
  };

  const canCreate = nickname.trim().length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <div className="bg-card mystery-border rounded-2xl p-8 shadow-neon">
            <h1 className="text-3xl md:text-4xl font-display text-foreground text-glow-red text-center mb-8">
              TẠO PHÒNG ĐIỀU TRA
            </h1>

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

            <div className="mb-6">
              <label className="block text-sm font-body font-bold text-muted-foreground mb-3">
                Độ khó
              </label>
              <div className="flex gap-2">
                {difficulties.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`flex-1 px-3 py-3 rounded-xl font-body font-bold text-sm text-center transition-all border ${
                      difficulty === d.id
                        ? d.color + " bg-muted/50"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <div>{d.label}</div>
                    <div className="text-xs opacity-60">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-body font-bold text-muted-foreground mb-3">
                <Users className="w-4 h-4 inline mr-1" />
                Số thám tử tối đa: <span className="text-accent">{maxPlayers}</span>
              </label>
              <input
                type="range"
                min={2}
                max={5}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-body mt-1">
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!canCreate || loading}
              className={`w-full px-6 py-4 rounded-xl font-display text-xl flex items-center justify-center gap-2 transition-all ${
                canCreate && !loading
                  ? "bg-danger-gradient text-foreground shadow-red hover:scale-[1.02]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? "ĐANG TẠO..." : "KHAI MỞ VỤ ÁN"}
            </button>
            {errorMsg && (
              <p className="text-primary text-sm font-body text-center mt-2">{errorMsg}</p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default CreateRoom;
