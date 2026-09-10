# Planning Poker

Planning poker multiusuário e em tempo real. Salas efêmeras, sem cadastro:
você digita um nome e compartilha o link.

## Stack

| Camada        | Tecnologia                                  |
| ------------- | ------------------------------------------- |
| App / UI      | Next.js (App Router) + React + Tailwind CSS  |
| Tempo real    | PartyKit (WebSocket, uma sala por partida)   |
| Estado        | Em memória no servidor da sala (sem banco)   |

O servidor esconde os votos até a revelação, então não dá para "trapacear"
pelo DevTools.

## Papel do criador da sala

Quem cria a sala vira o **criador** (identificado por um token salvo no
navegador, sobrevive a recarregar a página). Só o criador pode:

- revelar as cartas e iniciar uma nova rodada;
- criar, editar (título e descrição, num modal), ativar e excluir histórias;
- trocar o baralho;
- definir manualmente a pontuação final de cada história (o sistema mostra a
  média dos votos como sugestão).

Os demais participantes votam, viram espectadores e mudam o próprio nome.

## Rodando localmente

```bash
npm install
npm run dev
```

Isso sobe dois processos:

- **Next.js** em http://localhost:3000
- **PartyKit** em http://127.0.0.1:1999 (configurado em `.env.local`)

Abra `http://localhost:3000`, crie uma sala e abra o mesmo link em outra aba
ou dispositivo para ver a sincronização.

## Deploy

1. **Servidor de tempo real:**

   ```bash
   npx partykit deploy
   ```

   Anote o host gerado (ex.: `planning-poker-2026.SEU_USUARIO.partykit.dev`).

2. **App Next.js:** faça deploy na Vercel (ou similar) e defina a env var
   `NEXT_PUBLIC_PARTYKIT_HOST` com o host do passo 1.

## Estrutura

```
app/                 páginas Next.js
  page.tsx           tela inicial (criar / entrar)
  sala/[id]/         sala de planning poker (client component)
party/server.ts      servidor PartyKit (estado + protocolo)
lib/                 tipos e baralhos compartilhados
```

## Protocolo (cliente → servidor)

Todos: `join` · `vote` · `setSpectator` · `rename`

Só o criador: `reveal` · `reset` · `setDeck` · `addStory` · `updateStory` ·
`deleteStory` · `setActiveStory` · `setFinalScore`

O servidor responde com `welcome` (id da conexão) e `state` (snapshot completo
da sala) a cada mudança, e rejeita silenciosamente mensagens de criador vindas
de quem não é o criador.
