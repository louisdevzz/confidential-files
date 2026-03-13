import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Trophy, Sparkles, LogOut, Menu, X, Ticket, 
  User, Package, ChevronDown, Crown 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/rooms", label: "Phòng Chờ", icon: <Search className="w-4 h-4" /> },
  { to: "/ranking", label: "Bảng Xếp Hạng", icon: <Trophy className="w-4 h-4" /> },
  { to: "/gacha", label: "Gacha", icon: <Sparkles className="w-4 h-4" /> },
];

const Header = () => {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-display text-foreground text-glow-red leading-none">HỒ SƠ MẬT</span>
          <span className="hidden sm:block text-xs font-body text-muted-foreground mt-1">AI Ngoại Phạm</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors",
                location.pathname === link.to
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Gacha tickets */}
              <button
                onClick={() => navigate("/gacha")}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent font-body text-sm font-bold hover:bg-accent/20 transition-colors"
              >
                <Ticket className="w-4 h-4" />
                {user?.email === "louisdevzz04@gmail.com" ? (
                  <span className="flex items-center gap-1">
                    ∞
                    <span className="text-[10px] bg-danger-gradient px-1.5 py-0.5 rounded text-white">ADMIN</span>
                  </span>
                ) : (profile?.gacha_tickets ?? "...")}
              </button>

              {/* Create room button */}
              <button
                onClick={() => navigate("/create")}
                className="hidden sm:flex items-center gap-1.5 bg-danger-gradient px-4 py-2 rounded-lg font-display text-sm text-foreground shadow-red hover:scale-105 transition-transform"
              >
                <Sparkles className="w-4 h-4" />
                Tạo Phòng
              </button>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-muted/50 transition-colors"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username ?? "avatar"}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full ring-2 ring-accent/30 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary/30 ring-2 ring-accent/30 flex items-center justify-center text-secondary font-display text-sm">
                      {(profile?.username ?? user.email ?? "?")[0].toUpperCase()}
                    </div>
                  )}
                  <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    profileOpen && "rotate-180"
                  )} />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-card mystery-border rounded-xl shadow-xl overflow-hidden z-50"
                    >
                      {/* User Info */}
                      <div className="p-4 border-b border-border/50">
                        <div className="flex items-center gap-3">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={profile.username ?? "avatar"}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-full ring-2 ring-accent/30 object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-secondary/30 ring-2 ring-accent/30 flex items-center justify-center text-secondary font-display text-lg">
                              {(profile?.username ?? user.email ?? "?")[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-display text-foreground truncate">
                                {profile?.username || "Thám tử"}
                              </p>
                              {user?.email === "louisdevzz04@gmail.com" && (
                                <span className="px-1.5 py-0.5 rounded bg-danger-gradient text-white text-[10px] font-display">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-body truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="p-2">
                        <button
                          onClick={() => { navigate("/profile"); setProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left"
                        >
                          <User className="w-4 h-4" />
                          Hồ sơ của tôi
                        </button>

                        <button
                          onClick={() => { navigate("/gacha"); setProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left"
                        >
                          <Package className="w-4 h-4" />
                          Bộ sưu tập nhân vật
                        </button>

                        <button
                          onClick={() => { navigate("/gacha"); setProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm text-accent hover:bg-accent/10 transition-colors text-left"
                        >
                          <Ticket className="w-4 h-4" />
                          <span>Gacha ({user?.email === "louisdevzz04@gmail.com" ? "∞" : (profile?.gacha_tickets || 0)} vé)</span>
                        </button>

                        <div className="my-2 border-t border-border/50" />

                        <button
                          onClick={() => { signOut(); setProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          Đăng xuất
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-2 bg-card mystery-border px-4 py-2 rounded-lg font-body text-sm font-bold text-foreground hover:shadow-neon transition-shadow"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Đăng nhập Google
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur"
          >
            <nav className="px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-lg font-body text-sm font-medium transition-colors",
                    location.pathname === link.to
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
              {user && (
                <>
                  <button
                    onClick={() => { navigate("/create"); setMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg font-body text-sm font-medium text-accent hover:bg-muted/50 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Tạo Phòng Mới
                  </button>
                  <button
                    onClick={() => { signOut(); setMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg font-body text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng Xuất
                  </button>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
