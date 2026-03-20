import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown, Target, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchRanking } from "@/lib/roomService";
import type { Profile } from "@/lib/database.types";

const medalColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
const medalBg = ["bg-yellow-400/10 border-yellow-400/30", "bg-slate-300/10 border-slate-300/30", "bg-amber-600/10 border-amber-600/30"];

const winRate = (p: Profile) =>
  p.total_games > 0 ? Math.round((p.total_wins / p.total_games) * 100) : 0;

const Ranking = () => {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRanking().then((data) => {
      setPlayers(data as Profile[]);
      setLoading(false);
    });
  }, []);

  const myRank = user ? players.findIndex((p) => p.id === user.id) + 1 : 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-display text-foreground text-glow-gold mb-2">
              🏆 BẢNG XẾP HẠNG
            </h1>
            <p className="text-muted-foreground font-body">Top thám tử xuất sắc toàn server</p>
          </div>

          {/* My rank badge */}
          {user && myRank > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card mystery-border rounded-xl px-6 py-4 mb-8 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-display text-accent">#{myRank}</span>
                <span className="text-muted-foreground font-body text-sm">Vị trí của bạn</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-body">
                <span className="text-foreground font-bold">{players[myRank - 1]?.total_wins} thắng</span>
                <span className="text-muted-foreground">{players[myRank - 1]?.total_games} ván</span>
              </div>
            </motion.div>
          )}

          {/* Top 3 podium */}
          {!loading && players.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[1, 0, 2].map((idx) => {
                const p = players[idx];
                const rank = idx + 1;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex flex-col items-center p-4 rounded-2xl border ${
                      rank === 1 ? "border-yellow-400/40 bg-yellow-400/5 shadow-gold" : medalBg[rank - 1]
                    } ${idx === 0 ? "col-start-2 row-start-1" : ""}`}
                  >
                    <span className={`text-2xl font-display mb-1 ${medalColors[rank - 1]}`}>
                      {rank === 1 ? <Crown className="w-7 h-7 inline" /> : `#${rank}`}
                    </span>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" className={`w-12 h-12 rounded-full object-cover ring-2 ${rank === 1 ? "ring-yellow-400" : "ring-border"}`} />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-display text-xl ring-2 ${rank === 1 ? "ring-yellow-400 bg-yellow-400/20 text-yellow-400" : "ring-border bg-muted text-muted-foreground"}`}>
                        {(p.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="font-body font-bold text-foreground text-sm mt-2 truncate max-w-full text-center">
                      {p.username ?? "Ẩn danh"}
                    </span>
                    <span className={`font-display text-lg ${medalColors[rank - 1]}`}>{p.total_wins}</span>
                    <span className="text-muted-foreground font-body text-xs">thắng</span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Full leaderboard */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((p, i) => {
                const rank = i + 1;
                const isMe = user?.id === p.id;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${
                      isMe ? "bg-accent/10 mystery-border" : "bg-card/50 hover:bg-card"
                    }`}
                  >
                    {/* Rank */}
                    <span className={`w-8 text-center font-display text-lg shrink-0 ${
                      rank <= 3 ? medalColors[rank - 1] : "text-muted-foreground"
                    }`}>
                      {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                    </span>

                    {/* Avatar */}
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-secondary/30 flex items-center justify-center text-secondary font-display shrink-0">
                        {(p.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-body font-bold truncate block ${isMe ? "text-accent" : "text-foreground"}`}>
                        {p.username ?? "Ẩn danh"}
                        {isMe && <span className="ml-2 text-xs font-normal text-accent/70">(bạn)</span>}
                      </span>
                      <span className="text-muted-foreground font-body text-xs flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {p.total_games} ván · {winRate(p)}% thắng
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="font-display text-lg text-foreground">{p.total_wins}</span>
                        <span className="text-muted-foreground font-body text-xs block">thắng</span>
                      </div>
                      <div className="text-right">
                        <span className="font-body text-sm font-bold text-muted-foreground">{p.total_games}</span>
                        <span className="text-muted-foreground font-body text-xs block">ván</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {players.length === 0 && (
                <div className="text-center py-16 text-muted-foreground font-body">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  Chưa có ai lên bảng xếp hạng. Hãy là người đầu tiên!
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default Ranking;
