"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Extrai o id da sala de um link colado ou de um id cru. */
function parseRoomId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/sala\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    /* não é URL — tratar como id cru */
  }
  const clean = value.replace(/[^a-zA-Z0-9-]/g, "");
  return clean || null;
}

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function createRoom() {
    const id = crypto.randomUUID();
    // Marca este navegador como criador da sala (só ele reivindica o papel).
    try {
      localStorage.setItem(`pp-host-${id}`, crypto.randomUUID());
    } catch {
      /* ignora */
    }
    router.push(`/sala/${id}`);
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const id = parseRoomId(input);
    if (!id) {
      setError(true);
      return;
    }
    router.push(`/sala/${id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-10 px-6 py-16">
      <header className="text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl shadow-lg shadow-indigo-600/30">
          🃏
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Planning Poker</h1>
        <p className="mt-2 text-slate-500">
          Estimativas em equipe, em tempo real. Sem cadastro.
        </p>
      </header>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <button
          onClick={createRoom}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.99]"
        >
          Criar nova sala
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          ou entrar em uma sala
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={joinRoom} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            placeholder="Cole o link da sala"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Entrar
          </button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-600">Link ou código inválido.</p>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        O link da sala é o convite — quem o tiver consegue entrar. Não é possível
        adivinhar salas de outras pessoas.
      </p>
    </main>
  );
}
