import type * as Party from "partykit/server";
import { DECKS } from "../lib/decks";
import {
  HIDDEN,
  type ClientMessage,
  type RoomState,
  type ServerMessage,
  type Story,
} from "../lib/types";

type StoredPlayer = {
  id: string;
  name: string;
  vote: string | null;
  spectator: boolean;
  /** Token do dispositivo; define/identifica o criador da sala. */
  token: string | null;
};

type ServerState = {
  players: Record<string, StoredPlayer>;
  revealed: boolean;
  deckName: RoomState["deckName"];
  deck: readonly string[];
  stories: Story[];
  activeStoryId: string | null;
};

const HOST_ONLY: ReadonlySet<ClientMessage["type"]> = new Set([
  "reveal",
  "reset",
  "setDeck",
  "addStory",
  "updateStory",
  "deleteStory",
  "setActiveStory",
  "setFinalScore",
]);

export default class PokerServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  /** Primeiro token visto na sala; quem tiver esse token é o criador. */
  hostToken: string | null = null;

  state: ServerState = {
    players: {},
    revealed: false,
    deckName: "fibonacci",
    deck: DECKS.fibonacci,
    stories: [],
    activeStoryId: null,
  };

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "welcome", id: conn.id } satisfies ServerMessage));
    this.broadcastState();
  }

  onClose(conn: Party.Connection) {
    delete this.state.players[conn.id];
    this.broadcastState();
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (HOST_ONLY.has(msg.type) && !this.isHost(sender.id)) return;

    const player = this.state.players[sender.id];

    switch (msg.type) {
      case "join": {
        const token = typeof msg.token === "string" && msg.token ? msg.token : null;
        if (this.hostToken === null && token) this.hostToken = token;
        this.state.players[sender.id] = {
          id: sender.id,
          name: cleanName(msg.name),
          vote: null,
          spectator: Boolean(msg.spectator),
          token,
        };
        break;
      }
      case "vote": {
        if (
          player &&
          !player.spectator &&
          this.state.activeStoryId !== null &&
          this.state.deck.includes(msg.value)
        ) {
          player.vote = msg.value;
        }
        break;
      }
      case "reveal": {
        this.state.revealed = true;
        break;
      }
      case "reset": {
        this.resetVotes();
        break;
      }
      case "setDeck": {
        if (DECKS[msg.deckName]) {
          this.state.deckName = msg.deckName;
          this.state.deck = DECKS[msg.deckName];
          this.resetVotes();
        }
        break;
      }
      case "setSpectator": {
        if (player) {
          player.spectator = Boolean(msg.spectator);
          if (player.spectator) player.vote = null;
        }
        break;
      }
      case "rename": {
        if (player) player.name = cleanName(msg.name) || player.name;
        break;
      }
      case "addStory": {
        const title = String(msg.title ?? "").trim().slice(0, 120);
        if (!title) break;
        const story: Story = {
          id: crypto.randomUUID(),
          title,
          description: String(msg.description ?? "").trim().slice(0, 500),
          finalScore: null,
        };
        this.state.stories.push(story);
        if (this.state.activeStoryId === null) {
          this.state.activeStoryId = story.id;
          this.resetVotes();
        }
        break;
      }
      case "updateStory": {
        const story = this.state.stories.find((s) => s.id === msg.id);
        if (story) {
          const title = String(msg.title ?? "").trim().slice(0, 120);
          if (title) story.title = title;
          story.description = String(msg.description ?? "").trim().slice(0, 500);
        }
        break;
      }
      case "deleteStory": {
        this.state.stories = this.state.stories.filter((s) => s.id !== msg.id);
        if (this.state.activeStoryId === msg.id) {
          this.state.activeStoryId = this.state.stories[0]?.id ?? null;
          this.resetVotes();
        }
        break;
      }
      case "setActiveStory": {
        if (this.state.stories.some((s) => s.id === msg.id)) {
          this.state.activeStoryId = msg.id;
          this.resetVotes();
        }
        break;
      }
      case "setFinalScore": {
        const story = this.state.stories.find((s) => s.id === msg.id);
        if (story) {
          story.finalScore =
            msg.score === null ? null : String(msg.score).trim().slice(0, 12) || null;
        }
        break;
      }
    }

    this.broadcastState();
  }

  private resetVotes() {
    this.state.revealed = false;
    for (const p of Object.values(this.state.players)) p.vote = null;
  }

  private isHost(connId: string): boolean {
    const p = this.state.players[connId];
    return !!p && p.token !== null && p.token === this.hostToken;
  }

  private broadcastState() {
    const revealed = this.state.revealed;
    const players: Record<string, RoomState["players"][string]> = {};

    for (const [id, p] of Object.entries(this.state.players)) {
      players[id] = {
        id: p.id,
        name: p.name,
        spectator: p.spectator,
        isHost: p.token !== null && p.token === this.hostToken,
        vote: revealed ? p.vote : p.vote !== null ? HIDDEN : null,
      };
    }

    const hostPresent = Object.values(players).some((p) => p.isHost);

    const publicState: RoomState = {
      players,
      revealed: this.state.revealed,
      deckName: this.state.deckName,
      deck: this.state.deck,
      stories: this.state.stories,
      activeStoryId: this.state.activeStoryId,
      hostPresent,
    };

    this.room.broadcast(JSON.stringify({ type: "state", state: publicState } satisfies ServerMessage));
  }
}

function cleanName(name: unknown): string {
  return String(name ?? "").trim().slice(0, 40) || "Anônimo";
}
