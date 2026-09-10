"use client";

import Link from "next/link";
import usePartySocket from "partysocket/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cardToNumber, DECK_LABELS, DECKS, type DeckName } from "@/lib/decks";
import {
  HIDDEN,
  type ClientMessage,
  type RoomState,
  type ServerMessage,
  type Story,
} from "@/lib/types";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";

export default function PokerRoom({ roomId }: { roomId: string }) {
  const [name, setName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem("pp-name"));
    setHydrated(true);
  }, []);

  if (!hydrated) return <Centered>Carregando…</Centered>;

  if (!name) {
    return (
      <NameGate
        onSubmit={(n) => {
          localStorage.setItem("pp-name", n);
          setName(n);
        }}
      />
    );
  }

  return (
    <Room
      roomId={roomId}
      name={name}
      onRename={(n) => {
        localStorage.setItem("pp-name", n);
        setName(n);
      }}
    />
  );
}

function Room({
  roomId,
  name,
  onRename,
}: {
  roomId: string;
  name: string;
  onRename: (name: string) => void;
}) {
  const [token] = useState(() => {
    const key = `pp-token-${roomId}`;
    let t = localStorage.getItem(key);
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(key, t);
    }
    return t;
  });

  const [state, setState] = useState<RoomState | null>(null);
  const [selfId, setSelfId] = useState("");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [storyModal, setStoryModal] = useState<
    { mode: "new" } | { mode: "edit"; story: Story } | null
  >(null);

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    onOpen() {
      socket.send(
        JSON.stringify({ type: "join", name, token } satisfies ClientMessage),
      );
    },
    onMessage(event) {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === "welcome") setSelfId(msg.id);
      if (msg.type === "state") setState(msg.state);
    },
  });

  function send(msg: ClientMessage) {
    socket.send(JSON.stringify(msg));
  }

  const self = state?.players[selfId];
  const isHost = self?.isHost ?? false;

  useEffect(() => {
    if (self && self.vote === null) setMyVote(null);
  }, [self]);

  useEffect(() => {
    if (self && self.name !== name) send({ type: "rename", name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, self?.id]);

  const players = useMemo(
    () =>
      state
        ? Object.values(state.players).sort((a, b) => {
            if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
            return a.name.localeCompare(b.name, "pt-BR");
          })
        : [],
    [state],
  );

  if (!state) return <Centered>Conectando à sala…</Centered>;

  const activeStory =
    state.stories.find((s) => s.id === state.activeStoryId) ?? null;
  const voters = players.filter((p) => !p.spectator);
  const votedCount = voters.filter((p) => p.vote !== null).length;
  const everyoneVoted = voters.length > 0 && votedCount === voters.length;

  const revealedCards = voters
    .map((p) => p.vote)
    .filter((v): v is string => v !== null && v !== HIDDEN);
  const numbers = revealedCards
    .map(cardToNumber)
    .filter((n): n is number => n !== null);
  const average =
    numbers.length > 0
      ? Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 10) / 10
      : null;

  function castVote(value: string) {
    setMyVote(value);
    send({ type: "vote", value });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignora */
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            🃏 Planning Poker
          </Link>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-sm text-slate-600">
            {roomId}
          </span>
          <button
            onClick={copyLink}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? "Link copiado ✓" : "Copiar convite"}
          </button>

          <div className="ml-auto flex items-center gap-3">
            <select
              value={state.deckName}
              disabled={!isHost}
              onChange={(e) =>
                send({ type: "setDeck", deckName: e.target.value as DeckName })
              }
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-60"
            >
              {(Object.keys(DECKS) as DeckName[]).map((d) => (
                <option key={d} value={d}>
                  {DECK_LABELS[d]}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={self?.spectator ?? false}
                onChange={(e) =>
                  send({ type: "setSpectator", spectator: e.target.checked })
                }
              />
              Espectador
            </label>

            <button
              onClick={() => {
                const n = window.prompt("Seu nome", name)?.trim();
                if (n) onRename(n.slice(0, 40));
              }}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              {name}
              {isHost ? " · criador" : ""}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* História em votação */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Votando agora
            </span>
            {activeStory ? (
              <>
                <p className="mt-1 text-lg font-semibold">{activeStory.title}</p>
                {activeStory.description && (
                  <ActiveStoryDescription
                    key={activeStory.id}
                    text={activeStory.description}
                  />
                )}
              </>
            ) : (
              <p className="mt-1 text-slate-500">
                {isHost
                  ? "Crie uma história ao lado para começar."
                  : "Aguardando o criador escolher uma história."}
              </p>
            )}
          </div>

          {/* Mesa */}
          <section className="rounded-3xl bg-emerald-800/90 p-6 shadow-inner sm:p-10">
            <div className="flex flex-wrap justify-center gap-4">
              {players.length === 0 && (
                <p className="py-8 text-emerald-100">Ninguém na sala ainda…</p>
              )}
              {players.map((p) => (
                <PlayerSeat
                  key={p.id}
                  name={p.name}
                  isSelf={p.id === selfId}
                  isHost={p.isHost}
                  spectator={p.spectator}
                  revealed={state.revealed}
                  vote={p.vote}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {isHost ? (
                state.revealed ? (
                  <button
                    onClick={() => send({ type: "reset" })}
                    className="rounded-xl bg-white px-5 py-2.5 font-semibold text-emerald-900 shadow transition hover:bg-emerald-50"
                  >
                    Nova rodada
                  </button>
                ) : (
                  <button
                    onClick={() => send({ type: "reveal" })}
                    disabled={votedCount === 0}
                    className="rounded-xl bg-white px-5 py-2.5 font-semibold text-emerald-900 shadow transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Revelar cartas
                  </button>
                )
              ) : (
                <span className="rounded-xl bg-emerald-900/40 px-4 py-2 text-sm text-emerald-50">
                  {state.revealed
                    ? "Cartas reveladas"
                    : state.hostPresent
                      ? "Só o criador da sala revela as cartas"
                      : "Aguardando o criador da sala…"}
                </span>
              )}
              <span className="text-sm text-emerald-100">
                {votedCount}/{voters.length} votaram
                {everyoneVoted && !state.revealed ? " — prontos!" : ""}
              </span>
            </div>
          </section>

          {/* Resultado */}
          {state.revealed && (
            <Results
              cards={revealedCards}
              average={average}
              activeStory={activeStory}
              isHost={isHost}
              deck={state.deck}
              onSetScore={(score) =>
                activeStory &&
                send({ type: "setFinalScore", id: activeStory.id, score })
              }
            />
          )}

          {/* Baralho do jogador */}
          {self && self.spectator ? (
            <p className="text-center text-sm text-slate-400">
              Você está como espectador e não vota nesta rodada.
            </p>
          ) : !activeStory ? (
            <p className="text-center text-sm text-slate-400">
              {isHost
                ? "Selecione ou crie uma história para liberar a votação."
                : "Aguardando o criador selecionar uma história para votar."}
            </p>
          ) : (
            <section>
              <h2 className="mb-3 text-center text-sm font-medium uppercase tracking-wide text-slate-400">
                Sua carta
              </h2>
              <div className="flex flex-wrap justify-center gap-2">
                {state.deck.map((card) => {
                  const active = myVote === card;
                  return (
                    <button
                      key={card}
                      onClick={() => castVote(card)}
                      className={[
                        "flex h-20 w-14 items-center justify-center rounded-xl border-2 text-lg font-bold transition",
                        active
                          ? "-translate-y-2 border-indigo-600 bg-indigo-600 text-white shadow-lg"
                          : "border-slate-300 bg-white text-slate-700 hover:-translate-y-1 hover:border-indigo-400",
                      ].join(" ")}
                    >
                      {card}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <StoriesPanel
          stories={state.stories}
          activeStoryId={state.activeStoryId}
          isHost={isHost}
          onNew={() => setStoryModal({ mode: "new" })}
          onEdit={(story) => setStoryModal({ mode: "edit", story })}
          onActivate={(id) => send({ type: "setActiveStory", id })}
          onDelete={(id) => send({ type: "deleteStory", id })}
        />
      </main>

      {storyModal && (
        <StoryModal
          mode={storyModal.mode}
          story={storyModal.mode === "edit" ? storyModal.story : undefined}
          onClose={() => setStoryModal(null)}
          onSubmit={(title, description) => {
            if (storyModal.mode === "edit") {
              send({
                type: "updateStory",
                id: storyModal.story.id,
                title,
                description,
              });
            } else {
              send({ type: "addStory", title, description });
            }
            setStoryModal(null);
          }}
        />
      )}
    </div>
  );
}

function ActiveStoryDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamps, setClamps] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setClamps(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div className="mt-1">
      <p
        ref={ref}
        className={[
          "whitespace-pre-line text-sm text-slate-500",
          expanded ? "" : "line-clamp-3",
        ].join(" ")}
      >
        {text}
      </p>
      {(clamps || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-indigo-600 hover:underline"
        >
          {expanded ? "Ver menos" : "Ver descrição completa"}
        </button>
      )}
    </div>
  );
}

function PlayerSeat({
  name,
  isSelf,
  isHost,
  spectator,
  revealed,
  vote,
}: {
  name: string;
  isSelf: boolean;
  isHost: boolean;
  spectator: boolean;
  revealed: boolean;
  vote: string | null;
}) {
  const hasVoted = vote !== null;
  const showValue = revealed && hasVoted && vote !== HIDDEN;

  return (
    <div className="flex w-20 flex-col items-center gap-2">
      <div
        className={[
          "flex h-24 w-16 items-center justify-center rounded-xl text-xl font-bold transition",
          spectator
            ? "border-2 border-dashed border-emerald-300/50 text-emerald-200/60"
            : showValue
              ? "animate-pop-in bg-white text-slate-800 shadow-lg"
              : hasVoted
                ? "bg-indigo-500 text-white shadow-lg"
                : "border-2 border-emerald-500/40 bg-emerald-700/40",
        ].join(" ")}
      >
        {spectator ? "👁" : showValue ? vote : hasVoted ? "✓" : ""}
      </div>
      <span
        className={[
          "flex max-w-full items-center gap-1 truncate text-sm",
          isSelf ? "font-semibold text-white" : "text-emerald-50",
        ].join(" ")}
      >
        {isHost && <span title="Criador da sala">👑</span>}
        <span className="truncate">
          {name}
          {isSelf ? " (você)" : ""}
        </span>
      </span>
    </div>
  );
}

function Results({
  cards,
  average,
  activeStory,
  isHost,
  deck,
  onSetScore,
}: {
  cards: string[];
  average: number | null;
  activeStory: Story | null;
  isHost: boolean;
  deck: readonly string[];
  onSetScore: (score: string | null) => void;
}) {
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
  const distribution = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const consensus = distribution.length === 1 && cards.length > 1;

  const [draft, setDraft] = useState("");
  useEffect(() => {
    setDraft(activeStory?.finalScore ?? (average !== null ? String(average) : ""));
  }, [activeStory?.id, activeStory?.finalScore, average]);

  const numericDeck = deck.filter((c) => cardToNumber(c) !== null);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <span className="text-sm text-slate-400">Média</span>
          <p className="text-2xl font-bold">{average ?? "—"}</p>
        </div>
        <div>
          <span className="text-sm text-slate-400">Votos</span>
          <p className="text-2xl font-bold">{cards.length}</p>
        </div>
        {consensus && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
            Consenso 🎉
          </span>
        )}
        {activeStory?.finalScore != null && (
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
            Pontuação: {activeStory.finalScore}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {distribution.map(([card, n]) => (
          <div
            key={card}
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm"
          >
            <span className="font-bold">{card}</span>
            <span className="text-slate-500">
              {n} {n === 1 ? "voto" : "votos"}
            </span>
          </div>
        ))}
      </div>

      {isHost && activeStory && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <span className="text-sm font-medium text-slate-600">
            Definir pontuação de “{activeStory.title}”
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {numericDeck.map((c) => (
              <button
                key={c}
                onClick={() => onSetScore(c)}
                className={[
                  "h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold transition",
                  activeStory.finalScore === c
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 hover:border-indigo-400",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSetScore(draft.trim() || null);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="outro"
                className="h-9 w-20 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Salvar
              </button>
            </form>
            {activeStory.finalScore != null && (
              <button
                onClick={() => onSetScore(null)}
                className="h-9 rounded-lg px-2 text-sm text-slate-500 hover:text-slate-800"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function StoriesPanel({
  stories,
  activeStoryId,
  isHost,
  onNew,
  onEdit,
  onActivate,
  onDelete,
}: {
  stories: Story[];
  activeStoryId: string | null;
  isHost: boolean;
  onNew: () => void;
  onEdit: (story: Story) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const scored = stories.filter((s) => s.finalScore != null).length;

  return (
    <aside className="flex h-fit flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Histórias</h2>
        <span className="text-xs text-slate-400">
          {scored}/{stories.length} pontuadas
        </span>
      </div>

      {stories.length === 0 && (
        <p className="text-sm text-slate-400">Nenhuma história ainda.</p>
      )}

      <ul className="flex flex-col gap-2">
        {stories.map((s) => {
          const active = s.id === activeStoryId;
          return (
            <li
              key={s.id}
              className={[
                "rounded-xl border p-3 text-sm transition",
                active
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{s.title}</span>
                {s.finalScore != null && (
                  <span className="shrink-0 rounded-md bg-indigo-600 px-1.5 py-0.5 text-xs font-bold text-white">
                    {s.finalScore}
                  </span>
                )}
              </div>
              {s.description && (
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-slate-500">
                  {s.description}
                </p>
              )}
              {isHost && (
                <div className="mt-2 flex gap-3 text-xs font-medium">
                  {!active && (
                    <button
                      onClick={() => onActivate(s.id)}
                      className="text-indigo-600 hover:underline"
                    >
                      Votar esta
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(s)}
                    className="text-slate-500 hover:text-slate-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(s.id)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isHost ? (
        <button
          onClick={onNew}
          className="mt-1 rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
        >
          + Adicionar história
        </button>
      ) : (
        <p className="border-t border-slate-200 pt-3 text-xs text-slate-400">
          Só o criador da sala gerencia as histórias.
        </p>
      )}
    </aside>
  );
}

function StoryModal({
  mode,
  story,
  onClose,
  onSubmit,
}: {
  mode: "new" | "edit";
  story?: Story;
  onClose: () => void;
  onSubmit: (title: string, description: string) => void;
}) {
  const [title, setTitle] = useState(story?.title ?? "");
  const [description, setDescription] = useState(story?.description ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onSubmit(t.slice(0, 120), description.trim().slice(0, 500));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] min-h-[340px] w-[30rem] min-w-[19rem] max-w-[92vw] resize animate-pop-in flex-col overflow-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="shrink-0 text-lg font-bold">
          {mode === "edit" ? "Editar história" : "Nova história"}
        </h2>

        <form onSubmit={submit} className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <label className="flex shrink-0 flex-col gap-1 text-sm font-medium text-slate-600">
            Título
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Tela de login"
              maxLength={120}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base font-normal text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </label>

          <label className="flex min-h-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-600">
            Descrição
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, critérios de aceite…"
              rows={4}
              maxLength={500}
              className="min-h-[6rem] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-base font-normal text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </label>

          <div className="mt-2 flex shrink-0 justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {mode === "edit" ? "Salvar" : "Criar história"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Entrar na sala</h1>
        <p className="mt-1 text-slate-500">Como você quer aparecer para o time?</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = value.trim();
          if (n) onSubmit(n.slice(0, 40));
        }}
        className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Seu nome"
          className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="submit"
          className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      {children}
    </div>
  );
}
