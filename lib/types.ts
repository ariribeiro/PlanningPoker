import type { DeckName } from "./decks";

export type Player = {
  id: string;
  name: string;
  /** Valor real quando revelado; HIDDEN quando votou mas ainda não revelou; null quando não votou. */
  vote: string | null;
  spectator: boolean;
  isHost: boolean;
};

export type Story = {
  id: string;
  title: string;
  description: string;
  /** Pontuação final definida manualmente pelo criador da sala. */
  finalScore: string | null;
};

export type RoomState = {
  players: Record<string, Player>;
  revealed: boolean;
  deckName: DeckName;
  deck: readonly string[];
  stories: Story[];
  activeStoryId: string | null;
  /** Há pelo menos uma conexão do criador da sala ativa. */
  hostPresent: boolean;
};

export type ClientMessage =
  | { type: "join"; name: string; spectator?: boolean; token?: string }
  | { type: "vote"; value: string }
  | { type: "reveal" }
  | { type: "reset" }
  | { type: "setDeck"; deckName: DeckName }
  | { type: "setSpectator"; spectator: boolean }
  | { type: "rename"; name: string }
  // Apenas o criador da sala:
  | { type: "addStory"; title: string; description?: string }
  | { type: "updateStory"; id: string; title: string; description?: string }
  | { type: "deleteStory"; id: string }
  | { type: "setActiveStory"; id: string }
  | { type: "setFinalScore"; id: string; score: string | null };

export type ServerMessage =
  | { type: "welcome"; id: string }
  | { type: "state"; state: RoomState };

/** Marcador enviado ao cliente no lugar do voto real enquanto não há revelação. */
export const HIDDEN = "__hidden__";
