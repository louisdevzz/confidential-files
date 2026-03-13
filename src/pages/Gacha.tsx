import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Ticket, RefreshCw, Star, X, Gift, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { gachaService, type Character } from "@/services/gachaService";
import { useToast } from "@/components/ui/use-toast";

const RARITY_COLORS: Record<string, string> = {
  SSR: "from-yellow-400 via-orange-400 to-red-500",
  SR: "from-purple-400 via-pink-400 to-purple-500",
  R: "from-blue-400 via-cyan-400 to-blue-500",
  N: "from-gray-400 via-gray-300 to-gray-400",
};

const RARITY_GLOW: Record<string, string> = {
  SSR: "shadow-yellow-500/50",
  SR: "shadow-purple-500/50",
  R: "shadow-blue-500/50",
  N: "shadow-gray-500/30",
};

export default function GachaPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [rolledCharacter, setRolledCharacter] = useState<Character | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [collection, setCollection] = useState<Character[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    loadData();
  }, [user]);

  // Reload data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ticketsData, collectionData] = await Promise.all([
        gachaService.getTickets(),
        gachaService.getMyCollection(),
      ]);
      setTickets(ticketsData.tickets);
      setIsAdmin(ticketsData.isAdmin);
      setCollection(collectionData.map((c: any) => c.character));
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Lỗi!",
        description: "Không thể tải dữ liệu. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoll = async () => {
    // Chỉ kiểm tra vé nếu không phải admin
    if (!isAdmin && tickets < 1) {
      toast({
        title: "Không đủ vé!",
        description: "Bạn cần ít nhất 1 vé để quay Gacha.",
        variant: "destructive",
      });
      return;
    }

    setIsRolling(true);
    setShowResult(false);

    try {
      const result = await gachaService.rollGacha();
      
      // Animation delay
      setTimeout(() => {
        setRolledCharacter(result.character);
        setTickets(result.ticketsLeft);
        setIsAdmin(result.isAdmin);
        setIsRolling(false);
        setShowResult(true);
        
        // Add to collection if new
        if (!collection.find(c => c.id === result.character.id)) {
          setCollection(prev => [result.character, ...prev]);
        }

        toast({
          title: `Quay thành công!`,
          description: `Bạn nhận được ${result.character.name} (${result.rarity})`,
        });
      }, 2000);
    } catch (error: any) {
      setIsRolling(false);
      toast({
        title: "Lỗi!",
        description: error.message || "Không thể quay Gacha.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="font-body text-sm">Quay lại</span>
          </button>
          
          <h1 className="text-2xl font-display text-glow-gold">
            🎰 Gacha Nhân Vật
          </h1>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-display font-bold shadow-lg shadow-red-500/30">
                ADMIN
              </span>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent font-display">
              <Ticket className="w-5 h-5" />
              <span className="font-bold">{isAdmin ? "∞" : tickets}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Gacha Machine */}
        <div className="mb-8">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto">
            {/* Outer Ring */}
            <motion.div
              animate={isRolling ? { rotate: 360 } : {}}
              transition={isRolling ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
              className="absolute inset-0 rounded-full border-4 border-dashed border-accent/30"
            />
            
            {/* Gacha Ball */}
            <motion.div
              animate={isRolling ? {
                scale: [1, 1.1, 1],
                rotate: [0, 180, 360],
              } : {}}
              transition={isRolling ? { duration: 0.5, repeat: Infinity } : {}}
              className="absolute inset-8 rounded-full bg-gradient-to-br from-accent via-secondary to-primary flex items-center justify-center shadow-2xl shadow-accent/30"
            >
              {isRolling ? (
                <RefreshCw className="w-16 h-16 text-white animate-spin" />
              ) : (
                <Gift className="w-16 h-16 text-white" />
              )}
            </motion.div>

            {/* Sparkles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-accent rounded-full"
                style={{
                  top: `${20 + Math.sin(i * 60 * Math.PI / 180) * 35}%`,
                  left: `${20 + Math.cos(i * 60 * Math.PI / 180) * 35}%`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>

          {/* Roll Button */}
          <div className="mt-6 text-center">
            <motion.button
              whileHover={!isLoading && !isRolling ? { scale: 1.05 } : {}}
              whileTap={!isLoading && !isRolling ? { scale: 0.95 } : {}}
              onClick={handleRoll}
              disabled={isLoading || isRolling || (!isAdmin && tickets < 1)}
              className={`
                px-10 py-4 rounded-2xl font-display text-lg sm:text-xl text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isLoading || isRolling || (!isAdmin && tickets < 1) 
                  ? "bg-muted" 
                  : "bg-gradient-to-r from-red-500 via-pink-500 to-red-500 shadow-lg shadow-red-500/30 hover:shadow-xl"
                }
                transition-all duration-200
              `}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Đang tải...
                </span>
              ) : isRolling ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Đang quay...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  {isAdmin ? "Quay (Admin)" : "Quay (1 vé)"}
                </span>
              )}
            </motion.button>
            
            {!isLoading && !isAdmin && tickets < 1 && (
              <p className="mt-2 text-sm text-muted-foreground font-body">
                Bạn không có vé nào. Hoàn thành vụ án để nhận thêm vé!
              </p>
            )}
            
            {!isLoading && isAdmin && (
              <p className="mt-3 text-sm font-body">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-400 border border-red-500/30">
                  Chế độ Admin - Quay không giới hạn!
                </span>
              </p>
            )}
            
            {isLoading && (
              <p className="mt-2 text-sm text-muted-foreground font-body">
                Đang tải dữ liệu...
              </p>
            )}
          </div>
        </div>

        {/* Drop Rates */}
        <div className="mb-8 px-4">
          <h2 className="text-lg font-display text-center mb-4">Tỷ lệ rớt</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {[
              { rarity: "SSR", rate: "3%", color: "text-yellow-400", bg: "from-yellow-500/20 to-orange-500/20" },
              { rarity: "SR", rate: "15%", color: "text-purple-400", bg: "from-purple-500/20 to-pink-500/20" },
              { rarity: "R", rate: "35%", color: "text-blue-400", bg: "from-blue-500/20 to-cyan-500/20" },
              { rarity: "N", rate: "47%", color: "text-gray-400", bg: "from-gray-500/20 to-gray-400/20" },
            ].map((item) => (
              <div 
                key={item.rarity} 
                className={`text-center p-4 bg-gradient-to-br ${item.bg} border border-border/50 rounded-xl backdrop-blur-sm`}
              >
                <div className={`font-display text-2xl font-bold ${item.color} mb-1`}>{item.rarity}</div>
                <div className="text-sm text-muted-foreground font-body">{item.rate}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Collection Preview */}
        {collection.length > 0 && (
          <div>
            <h2 className="text-lg font-display mb-4">Bộ sưu tập ({collection.length})</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {collection.slice(0, 12).map((char) => (
                <motion.div
                  key={char.id}
                  whileHover={{ scale: 1.1 }}
                  className="aspect-square rounded-xl overflow-hidden bg-card mystery-border"
                >
                  <img
                    src={char.avatar_url}
                    alt={char.name}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              ))}
            </div>
            {collection.length > 12 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                +{collection.length - 12} nhân vật khác
              </p>
            )}
          </div>
        )}
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && rolledCharacter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowResult(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowResult(false)}
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-card mystery-border flex items-center justify-center text-muted-foreground hover:text-foreground z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Card */}
              <div className={`
                relative overflow-hidden rounded-3xl p-1
                bg-gradient-to-br ${RARITY_COLORS[rolledCharacter.rarity]}
                shadow-2xl ${RARITY_GLOW[rolledCharacter.rarity]}
              `}>
                <div className="bg-card rounded-[22px] overflow-hidden">
                  {/* Character Image */}
                  <div className="aspect-square relative">
                    <img
                      src={rolledCharacter.avatar_url}
                      alt={rolledCharacter.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    
                    {/* Rarity Badge */}
                    <div className={`
                      absolute top-4 right-4 px-3 py-1 rounded-full
                      bg-gradient-to-r ${RARITY_COLORS[rolledCharacter.rarity]}
                      font-display text-white text-sm
                    `}>
                      {rolledCharacter.rarity}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-6 text-center">
                    <h3 className="text-2xl font-display text-foreground mb-2">
                      {rolledCharacter.name}
                    </h3>
                    <p className="text-sm text-muted-foreground font-body">
                      {rolledCharacter.description}
                    </p>
                    
                    {/* New badge */}
                    {!collection.find(c => c.id === rolledCharacter.id)?.obtained_at && (
                      <div className="mt-4 inline-flex items-center gap-1 text-accent font-body text-sm">
                        <Sparkles className="w-4 h-4" />
                        Nhân vật mới!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Confetti effect */}
              {rolledCharacter.rarity === "SSR" && (
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: ["#FFD700", "#FFA500", "#FF6347"][i % 3],
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      animate={{
                        y: [0, -100, 0],
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.1,
                        repeat: Infinity,
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
