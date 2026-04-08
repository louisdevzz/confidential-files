import { supabase } from "@/lib/supabase";
import type { Room, Difficulty, GeneratedCase, GameMessage } from "@/lib/database.types";

const db = supabase as unknown as {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (...args: unknown[]) => any;
    insert: (...args: unknown[]) => any;
    update: (...args: unknown[]) => any;
    delete: (...args: unknown[]) => any;
  };
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
  const { data, error } = await db.rpc("create_room_with_host", {
    p_host_id: hostId,
    p_nickname: nickname.trim(),
    p_difficulty: difficulty,
    p_max_players: maxPlayers,
  });

  if (error) return { roomCode: "", error: error.message };

  const roomCode = (data as { room_code: string }[] | null)?.[0]?.room_code;
  if (!roomCode) {
    return { roomCode: "", error: "Không thể tạo phòng. Vui lòng thử lại." };
  }

  return { roomCode, error: null };
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
  const { data: room, error: fetchError } = await db
    .from("rooms")
    .select("*, room_members(count)")
    .eq("code", code.toUpperCase())
    .eq("status", "waiting")
    .single();

  if (fetchError || !room) return { room: null, error: "Không tìm thấy phòng hoặc phòng đã bắt đầu." };

  const memberCount = (room as unknown as { room_members: { count: number }[] }).room_members[0]?.count ?? 0;

  // Kiểm tra xem user đã là member chưa (host/member quay lại phòng)
  const { data: existing } = await db
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  // Đã là member → không cần insert, tránh vi phạm RLS UPDATE policy
  if (existing) return { room: room as Room, error: null };

  if (memberCount >= room.max_players) return { room: null, error: "Phòng đã đầy." };

  const { error: joinError } = await db
    .from("room_members")
    .insert({ room_id: room.id, user_id: userId, nickname, is_host: false });

  if (joinError) return { room: null, error: joinError.message };

  return { room: room as Room, error: null };
};

export const fetchWaitingRooms = async (): Promise<Room[]> => {
  const { data, error } = await db
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
  const { error } = await db
    .from("rooms")
    .update({ status: "playing" })
    .eq("code", code);
  return { error: error?.message ?? null };
};

export const fetchRoomWithMembers = async (
  code: string
): Promise<{ room: Room | null; members: import("@/lib/database.types").RoomMember[]; error: string | null }> => {
  const { data, error } = await db
    .from("rooms")
    .select("*, host:profiles!rooms_host_id_fkey(username, avatar_url), room_members(*, profile:profiles(username, avatar_url))")
    .eq("code", code)
    .single();

  if (error || !data) return { room: null, members: [], error: error?.message ?? "Không tìm thấy phòng" };

  const members = (data as unknown as { room_members: import("@/lib/database.types").RoomMember[] }).room_members ?? [];
  return { room: data as unknown as Room, members, error: null };
};

// ── Leave room ──────────────────────────────────────────────────────────────────────

export const leaveRoom = async ({
  roomCode,
  userId,
}: {
  roomCode: string;
  userId: string;
}): Promise<{ error: string | null }> => {
  // Fetch room + membership info
  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, host_id, status")
    .eq("code", roomCode)
    .single();

  if (roomErr || !room) return { error: "Không tìm thấy phòng." };

  // Don't allow leaving a game in progress
  if (room.status === "playing") return { error: "Không thể rời phòng khi đang chơi." };

  // Delete member record
  const { error: delErr } = await db
    .from("room_members")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", userId);

  if (delErr) return { error: delErr.message };

  // If the leaving user is the host
  if (room.host_id === userId) {
    // Check remaining members
    const { data: remaining } = await db
      .from("room_members")
      .select("user_id")
      .eq("room_id", room.id)
      .limit(1);

    if (remaining && remaining.length > 0) {
      // Transfer host to the first remaining member
      await db
        .from("rooms")
        .update({ host_id: remaining[0].user_id })
        .eq("id", room.id);

      await db
        .from("room_members")
        .update({ is_host: true })
        .eq("room_id", room.id)
        .eq("user_id", remaining[0].user_id);
    } else {
      // No members left → delete the room
      await db.from("rooms").delete().eq("id", room.id);
    }
  }

  return { error: null };
};

// ── Case & game messages ─────────────────────────────────────────────────────────────
export const saveCaseToRoom = async (
  code: string,
  caseData: GeneratedCase
): Promise<{ error: string | null }> => {
  const { error } = await db
    .from("rooms")
    .update({ case_data: caseData })
    .eq("code", code);
  return { error: error?.message ?? null };
};

export const fetchGameMessages = async (roomCode: string): Promise<GameMessage[]> => {
  const { data, error } = await db
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
  const { data, error } = await db
    .from("game_messages")
    .insert({ room_code: roomCode, role, sender_nickname: senderNickname, content })
    .select("id")
    .single();
  return {
    id: (data as { id: string } | null)?.id ?? null,
    error: error?.message ?? null,
  };
};

export const fetchRanking = async () => {
  const { data, error } = await db
    .from("profiles")
    .select("id, username, avatar_url, total_wins, total_games")
    .order("total_wins", { ascending: false })
    .limit(50);

  return error ? [] : data ?? [];
};
