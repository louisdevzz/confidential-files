import { supabase } from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3001/api";

export interface Character {
  id: string;
  name: string;
  rarity: "SSR" | "SR" | "R" | "N";
  description: string;
  avatar_url: string;
  subject: string | null;
  is_generated: boolean;
  created_at: string;
}

export interface GachaResult {
  success: boolean;
  character: Character;
  rarity: string;
  ticketsLeft: number;
  isAdmin: boolean;
}

export interface UserCharacter {
  id: string;
  user_id: string;
  character_id: string;
  obtained_at: string;
  is_equipped: boolean;
  character: Character;
}

// Helper to get auth token
const getAuthHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Authorization": `Bearer ${session?.access_token || ""}`,
    "x-user-id": session?.user?.id || "",
    "Content-Type": "application/json",
  };
};

export const gachaService = {
  // Get all available characters
  async getCharacters(): Promise<Character[]> {
    const response = await fetch(`${API_BASE_URL}/gacha/characters`);
    if (!response.ok) throw new Error("Failed to fetch characters");
    return response.json();
  },

  // Get user's collection
  async getMyCollection(): Promise<UserCharacter[]> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/gacha/my-collection`, {
      headers,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error("getMyCollection error:", errorData);
      throw new Error(errorData.error || `Failed to fetch collection: ${response.status}`);
    }
    return response.json();
  },

  // Get ticket count
  async getTickets(): Promise<{ tickets: number; isAdmin: boolean }> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/gacha/tickets`, {
      headers,
    });
    if (!response.ok) throw new Error("Failed to fetch tickets");
    const data = await response.json();
    return { tickets: data.tickets, isAdmin: data.isAdmin };
  },

  // Roll gacha
  async rollGacha(): Promise<GachaResult> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/gacha/roll`, {
      method: "POST",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to roll gacha");
    }
    return response.json();
  },

  // Generate new character with AI
  async generateCharacter(
    characterType: string,
    rarity: string,
    subject?: string
  ): Promise<{ success: boolean; character: Character }> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/gacha/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ characterType, rarity, subject }),
    });
    if (!response.ok) throw new Error("Failed to generate character");
    return response.json();
  },

  // Equip character as avatar
  async equipCharacter(characterId: string): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/gacha/equip`, {
      method: "POST",
      headers,
      body: JSON.stringify({ characterId }),
    });
    if (!response.ok) throw new Error("Failed to equip character");
  },

  // Get roll history
  async getHistory() {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/gacha/history`, {
      headers,
    });
    if (!response.ok) throw new Error("Failed to fetch history");
    return response.json();
  },
};
