import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, User, Ticket, Trophy, Edit3, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { gachaService, type Character } from "@/services/gachaService";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

const RARITY_COLORS: Record<string, string> = {
  SSR: "from-yellow-400 to-orange-500",
  SR: "from-purple-400 to-pink-500",
  R: "from-blue-400 to-cyan-500",
  N: "from-gray-400 to-gray-500",
};

const RARITY_BG: Record<string, string> = {
  SSR: "bg-yellow-500/20 border-yellow-500/50",
  SR: "bg-purple-500/20 border-purple-500/50",
  R: "bg-blue-500/20 border-blue-500/50",
  N: "bg-gray-500/20 border-gray-500/50",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [collection, setCollection] = useState<Character[]>([]);
  const [equippedId, setEquippedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(profile?.username || "");

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const collectionData = await gachaService.getMyCollection();
      setCollection(collectionData.map((c: any) => c.character));
      
      // Find equipped character
      const equipped = collectionData.find((c: any) => c.is_equipped);
      if (equipped) {
        setEquippedId(equipped.character_id);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEquipCharacter = async (characterId: string) => {
    try {
      await gachaService.equipCharacter(characterId);
      setEquippedId(characterId);
      
      // Update profile avatar in auth context
      const equippedChar = collection.find(c => c.id === characterId);
      if (equippedChar) {
        await supabase
          .from('profiles')
          .update({ avatar_url: equippedChar.avatar_url })
          .eq('id', user?.id);
      }
      
      toast({
        title: "Thành công!",
        description: "Đã đổi avatar",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể đổi avatar",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ username: newUsername.trim() })
        .eq('id', user?.id);
      
      setIsEditing(false);
      toast({
        title: "Thành công!",
        description: "Đã cập nhật tên",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật tên",
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
          
          <h1 className="text-xl font-display">Hồ Sơ Củ Tôi</h1>
          
          <div className="w-16"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Card */}
        <div className="bg-card mystery-border rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-accent/30">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary/30 flex items-center justify-center">
                    <User className="w-10 h-10 text-secondary" />
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate("/gacha")}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs hover:bg-accent/80 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Info */}
            <div className="flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="bg-input border border-border rounded-lg px-3 py-2 font-display text-lg"
                    placeholder="Tên của bạn"
                    maxLength={20}
                  />
                  <button
                    onClick={handleUpdateUsername}
                    className="p-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-display">{profile?.username || "Thám tử"}</h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <Edit3 className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground font-body mt-1">{user?.email}</p>
              
              {/* Stats */}
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1 text-accent">
                  <Ticket className="w-4 h-4" />
                  <span className="font-body text-sm font-bold">{profile?.gacha_tickets || 0} vé</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-400">
                  <Trophy className="w-4 h-4" />
                  <span className="font-body text-sm font-bold">{profile?.total_wins || 0} thắng</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display">Bộ Sưu Tập ({collection.length})</h2>
            <button
              onClick={() => navigate("/gacha")}
              className="px-4 py-2 rounded-lg bg-accent/10 text-accent font-body text-sm font-bold hover:bg-accent/20 transition-colors"
            >
              + Quay thêm
            </button>
          </div>
          
          {collection.length === 0 ? (
            <div className="text-center py-12 bg-card mystery-border rounded-2xl">
              <p className="text-muted-foreground font-body">Chưa có nhân vật nào</p>
              <button
                onClick={() => navigate("/gacha")}
                className="mt-4 px-6 py-3 rounded-xl bg-danger-gradient text-white font-display"
              >
                Quay Gacha Ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {collection.map((char) => (
                <motion.button
                  key={char.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleEquipCharacter(char.id)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    equippedId === char.id
                      ? `border-accent shadow-lg shadow-accent/30 ${RARITY_BG[char.rarity]}`
                      : 'border-border hover:border-accent/50'
                  }`}
                >
                  <img
                    src={char.avatar_url}
                    alt={char.name}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Rarity Badge */}
                  <div className={`absolute top-1 right-1 w-6 h-6 rounded-full bg-gradient-to-br ${RARITY_COLORS[char.rarity]} flex items-center justify-center text-white text-[10px] font-bold`}>
                    {char.rarity}
                  </div>
                  
                  {/* Equipped Indicator */}
                  {equippedId === char.id && (
                    <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                  
                  {/* Name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-[10px] font-body truncate">{char.name}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
