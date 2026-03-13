import { supabase } from "@/lib/supabase";
import type { Room, Subject, Difficulty, GeneratedCase, GameMessage } from "@/lib/database.types";

/** Tạo mã phòng 6 ký tự bằng CSPRNG */
const generateRoomCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
};

export interface CreateRoomParams {
  hostId: string;
  nickname: string;
  difficulty: Difficulty;
  maxPlayers: number;
}

export const createRoom = async ({
  hostId,
  nickname,
  difficulty,
  maxPlayers,
}: CreateRoomParams): Promise<{ roomCode: string; error: string | null }> => {
  // Thử tạo với code ngẫu nhiên (retry nếu trùng)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ code, host_id: hostId, difficulty, max_players: maxPlayers, status: "waiting" })
      .select("id")
      .single();

    if (roomError) {
      if (roomError.code === "23505") continue; // unique violation, retry
      return { roomCode: "", error: roomError.message };
    }

    const { error: memberError } = await supabase
      .from("room_members")
      .insert({ room_id: room.id, user_id: hostId, nickname, is_host: true });

    if (memberError) return { roomCode: "", error: memberError.message };

    return { roomCode: code, error: null };
  }
  return { roomCode: "", error: "Không thể tạo mã phòng. Vui lòng thử lại." };
};

export const joinRoom = async ({
  code,
  userId,
  nickname,
}: {
  code: string;
  userId: string;
  nickname: string;
}): Promise<{ room: Room | null; error: string | null }> => {
  const { data: room, error: fetchError } = await supabase
    .from("rooms")
    .select("*, room_members(count)")
    .eq("code", code.toUpperCase())
    .eq("status", "waiting")
    .single();

  if (fetchError || !room) return { room: null, error: "Không tìm thấy phòng hoặc phòng đã bắt đầu." };

  const memberCount = (room as unknown as { room_members: { count: number }[] }).room_members[0]?.count ?? 0;

  // Kiểm tra xem user đã là member chưa (host/member quay lại phòng)
  const { data: existing } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  // Đã là member → không cần insert, tránh vi phạm RLS UPDATE policy
  if (existing) return { room: room as Room, error: null };

  if (memberCount >= room.max_players) return { room: null, error: "Phòng đã đầy." };

  const { error: joinError } = await supabase
    .from("room_members")
    .insert({ room_id: room.id, user_id: userId, nickname, is_host: false });

  if (joinError) return { room: null, error: joinError.message };

  return { room: room as Room, error: null };
};

export const fetchWaitingRooms = async (): Promise<Room[]> => {
  const { data, error } = await supabase
    .from("rooms")
    .select("*, host:profiles!rooms_host_id_fkey(username, avatar_url), room_members(count)")
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data.map((r) => ({
    ...r,
    member_count: (r as unknown as { room_members: { count: number }[] }).room_members[0]?.count ?? 0,
  })) as Room[];
};

export const startGame = async (code: string): Promise<{ error: string | null }> => {
  const { error } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("code", code);
  return { error: error?.message ?? null };
};

export const fetchRoomWithMembers = async (
  code: string
): Promise<{ room: Room | null; members: import("@/lib/database.types").RoomMember[]; error: string | null }> => {
  const { data, error } = await supabase
    .from("rooms")
    .select("*, host:profiles!rooms_host_id_fkey(username, avatar_url), room_members(*, profile:profiles(username, avatar_url))")
    .eq("code", code)
    .single();

  if (error || !data) return { room: null, members: [], error: error?.message ?? "Không tìm thấy phòng" };

  const members = (data as unknown as { room_members: import("@/lib/database.types").RoomMember[] }).room_members ?? [];
  return { room: data as unknown as Room, members, error: null };
};

// ── Case & game messages ─────────────────────────────────────────────────────────────
export const saveCaseToRoom = async (
  code: string,
  caseData: GeneratedCase
): Promise<{ error: string | null }> => {
  const { error } = await supabase
    .from("rooms")
    .update({ case_data: caseData })
    .eq("code", code);
  return { error: error?.message ?? null };
};

export const fetchGameMessages = async (roomCode: string): Promise<GameMessage[]> => {
  const { data, error } = await supabase
    .from("game_messages")
    .select("*")
    .eq("room_code", roomCode)
    .order("created_at", { ascending: true });
  return error ? [] : (data as GameMessage[]) ?? [];
};

export const insertGameMessage = async (
  roomCode: string,
  role: "user" | "ai",
  senderNickname: string,
  content: string
): Promise<{ id: string | null; error: string | null }> => {
  const { data, error } = await supabase
    .from("game_messages")
    .insert({ room_code: roomCode, role, sender_nickname: senderNickname, content })
    .select("id")
    .single();
  return {
    id: (data as { id: string } | null)?.id ?? null,
    error: error?.message ?? null,
  };
};

export const fetchRanking = async () => {  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, total_wins, total_games, gacha_tickets")
    .order("total_wins", { ascending: false })
    .limit(50);

  return error ? [] : data ?? [];
};
