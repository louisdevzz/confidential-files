export type Subject = "math" | "physics" | "chemistry" | "biology";

/** Dữ liệu vụ án đầy đủ — CHỈ tồn tại server-side (DB / Edge Function) */
export interface GeneratedCase {
  boi_canh: string;             // Hiện trường vụ án
  ten_hung_thu: string;         // Tên + nghề nghiệp hung thủ
  loi_khai: string;             // Lời khai giả (có lỗi sai kiến thức)
  kien_thuc_an: string;         // Đáp án khoa học đúng (chỉ dùng cho system prompt Tầng 2)
  tu_khoa_thang_cuoc: string[]; // Từ khoá để AI judge win — SERVER-SIDE ONLY, không gửi về client
}

/**
 * Phiên bản an toàn của GeneratedCase trả về cho client.
 * tu_khoa_thang_cuoc đã bị omit để tránh lộ đáp án.
 */
export type SafeGeneratedCase = Omit<GeneratedCase, "tu_khoa_thang_cuoc">;

/** Tin nhắn trong phòng chơi (shared realtime chat) */
export interface GameMessage {
  id: string;
  room_code: string;
  role: "user" | "ai";
  sender_nickname: string | null;
  content: string;
  created_at: string;
}
export type Difficulty = "easy" | "medium" | "hard";
export type RoomStatus = "waiting" | "playing" | "finished";

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  total_wins: number;
  total_games: number;
  created_at: string;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  subjects: Subject[];
  difficulty: Difficulty;
  max_players: number;
  status: RoomStatus;
  created_at: string;
  /** Safe subset — tu_khoa_thang_cuoc is stripped before returning to client */
  case_data?: SafeGeneratedCase | null;
  host?: Profile;
  member_count?: number;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  is_host: boolean;
  joined_at: string;
  profile?: Profile;
}

export interface CreateRoomWithHostResult {
  room_id: string;
  room_code: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      rooms: {
        Row: Room;
        Insert: Omit<Room, "id" | "created_at" | "host" | "member_count">;
        Update: Partial<Omit<Room, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "rooms_host_id_fkey";
            columns: ["host_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
            isOneToOne: false;
          }
        ];
      };
      room_members: {
        Row: RoomMember;
        Insert: Omit<RoomMember, "id" | "joined_at">;
        Update: Partial<Omit<RoomMember, "id" | "joined_at">>;
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey";
            columns: ["room_id"];
            referencedRelation: "rooms";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "room_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
            isOneToOne: false;
          }
        ];
      };
      game_messages: {
        Row: GameMessage;
        Insert: Omit<GameMessage, "id" | "created_at">;
        Update: Partial<Omit<GameMessage, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_room_with_host: {
        Args: {
          p_host_id: string;
          p_nickname: string;
          p_difficulty: Difficulty;
          p_max_players: number;
        };
        Returns: CreateRoomWithHostResult[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
