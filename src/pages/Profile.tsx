import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, User, Trophy, Edit3, Check, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(profile?.username || "");

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user]);

  const winRate =
    profile && profile.total_games > 0
      ? Math.round((profile.total_wins / profile.total_games) * 100)
      : 0;

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
                <div className="flex items-center gap-1 text-yellow-400">
                  <Trophy className="w-4 h-4" />
                  <span className="font-body text-sm font-bold">{profile?.total_wins || 0} thắng</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Target className="w-4 h-4" />
                  <span className="font-body text-sm font-bold">{profile?.total_games || 0} ván · {winRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
