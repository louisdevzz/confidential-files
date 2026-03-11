import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Users, Crown, Clock, Sparkles } from "lucide-react";
import { useState } from "react";

const mockPlayers = [
  { name: "Sherlock", isHost: true },
  { name: "Watson", isHost: false },
];

const Lobby = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 font-body"
        >
          <ArrowLeft className="w-5 h-5" />
          Rời phòng
        </button>
      </header>

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

            {/* Players */}
            <div className="mb-6">
              <h2 className="text-sm font-body font-bold text-muted-foreground mb-3 flex items-center justify-center gap-1">
                <Users className="w-4 h-4" />
                Thám tử trong phòng ({mockPlayers.length}/4)
              </h2>
              <div className="space-y-2">
                {mockPlayers.map((p, i) => (
                  <motion.div
                    key={p.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-secondary/30 flex items-center justify-center text-secondary font-display text-sm">
                        {p.name[0]}
                      </div>
                      <span className="font-body font-bold text-foreground">{p.name}</span>
                    </div>
                    {p.isHost && (
                      <Crown className="w-4 h-4 text-accent" />
                    )}
                  </motion.div>
                ))}

                {/* Waiting slots */}
                {[...Array(4 - mockPlayers.length)].map((_, i) => (
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

            {/* Start Game */}
            <button className="w-full bg-danger-gradient px-6 py-4 rounded-xl font-display text-xl text-foreground shadow-red hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              BẮT ĐẦU ĐIỀU TRA
            </button>

            <p className="text-muted-foreground text-xs font-body mt-4">
              Chia sẻ mã phòng cho bạn bè để cùng tham gia 🔍
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Lobby;
