import { motion } from "framer-motion";
import { Search, Users, Trophy, Sparkles, ArrowRight, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-mystery.png";
import charactersImage from "@/assets/characters-lineup.png";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const HeroSection = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const { user, signInWithGoogle } = useAuth();

  return (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
    {/* Background image with overlay */}
    <div className="absolute inset-0">
      <img src={heroImage} alt="Mystery detective scene" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />
    </div>

    <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <p className="text-accent font-body font-bold text-sm md:text-base tracking-widest uppercase mb-4">
          🔍 Trinh Thám Học Đường Co-op
        </p>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-display text-foreground text-glow-red leading-tight mb-2">
          HỒ SƠ MẬT
        </h1>
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-display text-accent text-glow-gold mb-6">
          AI NGOẠI PHẠM
        </h2>
        <p className="text-muted-foreground font-body text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
          Lập tổ đội, hỏi cung AI, dùng kiến thức khoa học để bẻ gãy lập luận dối trá. Ép hung thủ nhận tội, cày điểm quay Gacha!
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="flex flex-col sm:flex-row gap-4 justify-center"
      >
        {user ? (
          <>
            <button onClick={() => onNavigate("/create")} className="bg-danger-gradient px-8 py-4 rounded-xl font-display text-xl text-foreground shadow-red hover:scale-105 transition-transform flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              TẠO PHÒNG
            </button>
            <button onClick={() => onNavigate("/rooms")} className="mystery-border bg-muted/50 backdrop-blur px-8 py-4 rounded-xl font-display text-xl text-mystery-glow shadow-neon hover:scale-105 transition-transform flex items-center justify-center gap-2">
              <ArrowRight className="w-5 h-5" />
              VÀO PHÒNG
            </button>
          </>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="flex items-center justify-center gap-3 bg-card mystery-border px-10 py-4 rounded-xl font-display text-xl text-foreground shadow-neon hover:scale-105 transition-transform"
          >
            <LogIn className="w-6 h-6" />
            ĐĂNG NHẬP ĐỂ CHƠI
          </button>
        )}
      </motion.div>
    </div>

    {/* Floating particles effect */}
    <div className="absolute inset-0 pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-mystery-glow rounded-full opacity-40"
          style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
          animate={{ y: [-10, 10, -10], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  </section>
  );
};

const steps = [
  {
    icon: <Search className="w-8 h-8" />,
    title: "SINH ÁN",
    desc: "AI tự động tạo vụ án ngẫu nhiên với lờ khai giả chứa lỗi khoa học",
    color: "text-primary",
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "THẨM VẤN",
    desc: "3-5 học sinh cùng hỏi cung AI ngoan cố, bẻ gãy lập luận dối trá",
    color: "text-secondary",
  },
  {
    icon: <Trophy className="w-8 h-8" />,
    title: "CHỐT HẠ",
    desc: "Tìm ra chân lý, ép AI nhận tội! MVP nhận vé Gacha & flex bảng xếp hạng",
    color: "text-accent",
  },
];

const GameplaySection = () => (
  <section className="py-20 px-4 relative">
    <div className="max-w-6xl mx-auto">
      <motion.h2
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-4xl md:text-5xl font-display text-center text-foreground text-glow-purple mb-16"
      >
        ⚔️ VÒNG LẶP GAMEPLAY
      </motion.h2>

      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2 }}
            className="bg-card mystery-border rounded-2xl p-8 text-center hover:shadow-neon transition-shadow"
          >
            <div className={`${step.color} mb-4 flex justify-center`}>{step.icon}</div>
            <h3 className="text-2xl font-display text-foreground mb-3">{step.title}</h3>
            <p className="text-muted-foreground font-body leading-relaxed">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const CharactersSection = () => (
  <section className="py-20 px-4 relative overflow-hidden">
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="flex-1"
      >
        <h2 className="text-4xl md:text-5xl font-display text-foreground text-glow-gold mb-6">
          🎴 GACHA & THẺ NHÂN VẬT
        </h2>
        <p className="text-muted-foreground font-body text-lg leading-relaxed mb-6">
          Thu thập thẻ nhân vật SSR, SR từ hệ thống Gacha. Flex khung Avatar độc quyền trên bảng xếp hạng. Dùng đạo cụ đặc biệt để "chơi dơ" bạn bè ở ván sau!
        </p>
        <div className="flex gap-3">
          {["SSR", "SR", "R"].map((rarity, i) => (
            <span
              key={rarity}
              className={`px-4 py-2 rounded-lg font-display text-sm ${
                i === 0
                  ? "bg-gold-gradient text-accent-foreground shadow-gold"
                  : i === 1
                  ? "bg-secondary/30 text-secondary mystery-border"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {rarity}
            </span>
          ))}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="flex-1"
      >
        <img
          src={charactersImage}
          alt="Game characters"
          className="w-full max-w-md mx-auto animate-float drop-shadow-2xl"
        />
      </motion.div>
    </div>
  </section>
);

const LobbySection = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const { user, signInWithGoogle } = useAuth();
  const [roomCode, setRoomCode] = useState("");

  const handleJoin = () => {
    if (roomCode.trim()) onNavigate(`/lobby/${roomCode.trim().toUpperCase()}`);
  };

  return (
    <section className="py-20 px-4" id="lobby">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card mystery-border rounded-2xl p-8 shadow-neon"
        >
          <h2 className="text-3xl font-display text-center text-foreground text-glow-purple mb-8">
            🚪 PHÒNG ĐIỀU TRA
          </h2>

          {user ? (
            <>
              <div className="space-y-4 mb-6">
                <button onClick={() => onNavigate("/create")} className="w-full bg-danger-gradient px-6 py-4 rounded-xl font-display text-lg text-foreground shadow-red hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  TẠO PHÒNG MỚI
                </button>
                <button onClick={() => onNavigate("/rooms")} className="w-full mystery-border bg-muted/50 px-6 py-4 rounded-xl font-display text-lg text-mystery-glow shadow-neon hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                  <Search className="w-5 h-5" />
                  XEM PHÒNG ĐANG CHỜ
                </button>
              </div>

              <div className="relative flex items-center gap-2 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-muted-foreground font-body text-sm">hoặc nhập mã</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập mã phòng..."
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 bg-input border border-border rounded-xl px-4 py-3 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-mystery-glow/50 uppercase tracking-widest"
                />
                <button
                  onClick={handleJoin}
                  disabled={!roomCode.trim()}
                  className="bg-secondary/80 mystery-border px-6 py-3 rounded-xl font-display text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  VÀO
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground font-body mb-6">Đăng nhập để tạo phòng và tham gia điều tra cùng bạn bè!</p>
              <button
                onClick={signInWithGoogle}
                className="flex items-center justify-center gap-3 mx-auto bg-muted mystery-border px-8 py-4 rounded-xl font-display text-lg text-foreground hover:shadow-neon transition-shadow"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                ĐĂNG NHẬP VỚI GOOGLE
              </button>
            </div>
          )}

          <p className="text-muted-foreground text-center text-sm font-body mt-6">
            Mỗi phòng từ 3-5 thám tử. Sẵn sàng phá án? 🕵️
          </p>
        </motion.div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="py-8 px-4 border-t border-border">
    <div className="max-w-6xl mx-auto text-center">
      <p className="font-display text-2xl text-foreground text-glow-red mb-2">HỒ SƠ MẬT: AI NGOẠI PHẠM</p>
      <p className="text-muted-foreground font-body text-sm">
        Game hóa học tập · Trinh thám Co-op · AI Game Master
      </p>
    </div>
  </footer>
);

const Index = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <HeroSection onNavigate={navigate} />
      <GameplaySection />
      <CharactersSection />
      <LobbySection onNavigate={navigate} />
      <Footer />
    </div>
  );
};

export default Index;
