# Outside Surf School · Romário de Jesus

App de agendamento de aulas de surf (PWA) em Jaguaribe e no Farol da Barra, Salvador.
Mesma base técnica da Toni Barbearia: **Cloudflare Workers (Hono) + Supabase (PostgreSQL) + React/Vite**.

## Duas telas separadas
- **Aluno** (`/`): cadastro rápido (nome, celular e senha), agendar, pagar o sinal pelo Pix, minhas aulas,
  cancelar/remarcar no prazo, previsão do mar, perfil, privacidade, instalar o app.
- **Instrutor** (`/painel`): app instalável à parte, com senha + verificação em duas etapas. Agenda, conferência de Pix,
  reservas, alunos, quiver, textos e fotos, ajustes, financeiro e sistema.

## Regras principais
- Sinal (padrão 50%) pelo Pix com QR Code e copia e cola com o valor exato. O aluno avisa "já fiz o Pix" e o horário fica
  guardado; o Romário confere no banco e confirma no painel. O gateway (cartão/Pix automático) entra quando for escolhido.
- Cancelamento pelo app até X horas antes (o Romário define). Aula avulsa: o valor pago fica **a devolver** e o Romário
  marca quando devolver. Pacote: a aula volta como crédito.
- Lembretes configuráveis (padrão: 1 dia antes, 3 h antes e "hoje tem aula" às 6h30), para aluno e instrutor, nunca de madrugada.
- Quiver desligado por padrão: o aluno nem vê que existe até o Romário ligar.
- Vagas travadas no banco: duas pessoas nunca pegam a mesma última vaga (testado com reservas simultâneas).

## Motor de ondas
O servidor coleta a previsão a cada 3 h (Open-Meteo: modelos de ondas ECMWF/Météo-France e vento) e calcula a
**onda estimada na praia** de cada pico: separa swell e mar de vento, aplica a exposição do pico à direção da ondulação
(o Farol é abrigado de leste) e a altura de arrebentação de Komar & Gaughan; o Romário calibra cada pico em Ajustes.
Os horários do Farol seguem a maré baixa da previsão (ou estimativa, ou os horários que o Romário definir no dia).

## Desenvolvimento
```bash
npm ci
npm run typecheck && npm test           # testes com PostgreSQL (TEST_DATABASE_URL)
DATABASE_URL=postgres://... npx tsx scripts/dev-seed.ts   # banco local com dados fictícios
npm run cf:dev                          # build + runtime real da Cloudflare
```
Publicação, segredos, monitoramento e custos: **[DEPLOY.md](DEPLOY.md)**.
