import { motion } from "framer-motion";
import { Search, Users, Trophy, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-mystery.png";
import charactersImage from "@/assets/characters-lineup.png";
import { useState } from "react";

const HeroSection = ({ onNavigate }: { onNavigate: (path: string) => void }) => (
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
          Lập tổ đội, hỏi cung AI, dùng kiến thức <span className="text-accent font-bold">Toán - Lý - Hóa - Sinh</span> để bẻ gãy lập luận dối trá. Ép hung thủ nhận tội, cày điểm quay Gacha!
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="flex flex-col sm:flex-row gap-4 justify-center"
      >
        <button onClick={() => onNavigate("/create")} className="bg-danger-gradient px-8 py-4 rounded-xl font-display text-xl text-foreground shadow-red hover:scale-105 transition-transform flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5" />
          TẠO PHÒNG
        </button>
        <button onClick={() => onNavigate("/join")} className="mystery-border bg-muted/50 backdrop-blur px-8 py-4 rounded-xl font-display text-xl text-mystery-glow shadow-neon hover:scale-105 transition-transform flex items-center justify-center gap-2">
          <ArrowRight className="w-5 h-5" />
          VÀO PHÒNG
        </button>
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

const steps = [
  {
    icon: <Search className="w-8 h-8" />,
    title: "SINH ÁN",
    desc: "AI tự động tạo vụ án ngẫu nhiên với lời khai giả chứa lỗi kiến thức",
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
  const [roomCode, setRoomCode] = useState("");

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

          <div className="space-y-4 mb-6">
            <button onClick={() => onNavigate("/create")} className="w-full bg-danger-gradient px-6 py-4 rounded-xl font-display text-lg text-foreground shadow-red hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              TẠO PHÒNG MỚI
            </button>
          </div>

          <div className="relative flex items-center gap-2 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground font-body text-sm">hoặc</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nhập mã phòng..."
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="flex-1 bg-input border border-border rounded-xl px-4 py-3 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-mystery-glow/50"
            />
            <button className="bg-secondary/80 mystery-border px-6 py-3 rounded-xl font-display text-foreground hover:bg-secondary transition-colors">
              VÀO
            </button>
          </div>

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
