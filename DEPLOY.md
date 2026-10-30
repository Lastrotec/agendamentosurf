# Publicar a Outside Surf School (Cloudflare Workers + Supabase)

A publicação roda pelo **GitHub Actions** (`.github/workflows/deploy.yml`) a cada push na `main`:
testes → migrações do banco → Hyperdrive → build → deploy do Worker → segredos → validação.

> As chaves do Supabase e o token da Cloudflare foram compartilhados em texto. Depois que tudo estiver no ar,
> **troque a senha do banco** (Supabase → Project Settings → Database) e **gere um token novo** na Cloudflare,
> atualizando os segredos abaixo. As chaves `anon`, `service_role`, `sb_publishable` e `sb_secret` **não são usadas** pelo app.

## 1. Supabase
1. No projeto, clique em **Connect** e copie a string **Session pooler** (porta 5432, usuário `postgres.<ref>`).
   - A conexão "Direct" do plano gratuito é só IPv6 e não funciona no GitHub Actions.
   - Na senha, caracteres especiais precisam ser codificados: `@` vira `%40`.
2. Opcional: copie também a **Transaction pooler** (porta 6543) para o Hyperdrive.

## 2. Cloudflare
Token com as permissões: **Workers Scripts: Edit**, **Account → Hyperdrive: Edit** e **Account Settings: Read**.
Anote o **Account ID** (painel da Cloudflare → Workers & Pages → lado direito).

## 3. GitHub → Settings → Secrets and variables → Actions
Só **3 segredos** são obrigatórios:

| Nome | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token do passo 2 |
| `SUPABASE_DIRECT_URL` | Session/Shared pooler (porta 5432) com a senha codificada (`@` vira `%40`) |
| `ADMIN_PASSWORD` | senha do painel do Romário (12+ caracteres, letras e números) |

Opcionais: `ADMIN_EMAIL` (padrão `romario@outsidesurf.com.br`), `CLOUDFLARE_ACCOUNT_ID` (se o token tiver mais de uma conta),
`SUPABASE_POOLER_URL`, `BACKUP_AGE_PUBLIC_KEY` e a variável `APP_URL`.
A chave de criptografia, o sal e as chaves das notificações (`DATA_ENCRYPTION_KEY`, `RATE_LIMIT_SALT`, `VAPID_*`) são
**gerados automaticamente** na primeira publicação e guardados como segredos do Worker. O acesso do instrutor é criado
na primeira publicação e nunca é sobrescrito depois.

## 4. Primeira publicação
1. Faça o merge na `main` (ou rode **Actions → Deploy → Run workflow**).
3. Abra `APP_URL/painel`, entre com o e-mail e a senha, configure a verificação em duas etapas (obrigatória),
   ative as notificações e confira **Ajustes** (Pix, prazos, lembretes) e **Textos e fotos**.
4. Domínio próprio: Cloudflare → Workers → `outside-surf` → Settings → Domains & Routes.

## 5. Monitoramento e "não deixar o Supabase dormir"
- O Cron do Worker lê o banco **a cada 15 minutos** (também envia lembretes e expira reservas sem pagamento).
- `keepalive.yml` faz uma leitura diária pelo GitHub, independente da Cloudflare.
- UptimeRobot (grátis): monitor HTTP em `APP_URL/health/db` a cada 5 min — avisa por e-mail se cair e mantém o banco ativo.
- O painel mostra em **Sistema** a última verificação, o espaço usado no banco e a última coleta da previsão.

## 6. Backup
`backup.yml` (a cada 12 h) gera um dump, testa a restauração e guarda o arquivo criptografado como artefato privado por 30 dias.
Restaurar: `AGE_IDENTITY=chave.txt TARGET_DATABASE_URL=... scripts/restore.sh arquivo.dump.age`.

## Planos gratuitos: aguenta 200 alunos por mês?
Sim, com folga. Estimativa para 200 alunos ativos/mês (≈ 600–800 aulas):

| Recurso | Uso estimado | Limite gratuito (confira os valores atuais nos painéis) |
|---|---|---|
| Requisições do Worker | ≈ 1–3 mil/dia (o app abre com 2–3 chamadas; fotos, fontes e JS não passam pelo Worker) | 100 mil/dia |
| Cron | 96 + 8 + 1 execuções/dia | 5 gatilhos por conta (usamos 3) |
| Banco (Supabase) | < 30 MB no 1º ano (alunos e aulas ocupam poucos KB; fotos comprimidas ≈ 100–250 KB cada) | 500 MB |
| Tráfego do banco | baixo: configuração, previsão e fotos ficam em cache na borda da Cloudflare | 5 GB/mês |
| Push | uma chamada por aviso, até 35 por execução do Cron | sem custo |

Otimizações já feitas: previsão coletada pelo servidor a cada 3 h (os alunos não chamam o serviço externo),
cache na borda para configuração (30 s), previsão (15 min) e fotos (1 ano, endereço pelo hash), configuração em memória,
sessão do aluno de 180 dias (menos logins, que são a operação mais pesada) e nenhuma consulta periódica do app.

Ponto de atenção: o login usa PBKDF2 com 100 mil iterações (~10–20 ms de CPU). O plano gratuito permite 10 ms por requisição
e tolera picos ocasionais; se aparecer "Exceeded CPU" no login, o Workers Paid custa US$ 5/mês. Não reduza as iterações.

**Previsão do mar:** a Open-Meteo é gratuita só para uso **não comercial**. Para a escola, contrate o plano comercial
(a partir de ~€29/mês na data desta versão) ou troque a fonte em `src/worker/services/forecast.ts`.
