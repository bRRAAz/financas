# Meu Financeiro

Aplicação de controle financeiro pessoal com projeção do saldo por dia e por mês. Permite gerenciar lançamentos, recorrências, transferências, contas, categorias, cartões, compras parceladas e pagamentos de faturas. O painel distingue saldo realizado de saldo projetado. A simulação de gastos permite comparar cenários antes de registrar uma despesa.

A interface usa português do Brasil, reais (BRL) e o fuso America/Fortaleza. O calendário calcula com datas civis em formato ISO e exibe datas em formato brasileiro.

## Tecnologias e estrutura

React, Vite, TypeScript, Tailwind CSS, componentes locais shadcn/ui com Radix UI, Lucide React, Recharts, React Hook Form, Zod, TanStack Query, React Router e Supabase Auth/PostgreSQL. Os testes usam Vitest e PGlite.

| Caminho | Conteúdo |
| --- | --- |
| `src/pages/` | Os sete módulos do aplicativo |
| `src/components/` | Componentes de interface, gráficos e formulários |
| `src/lib/finance.ts` | Ocorrências, parcelas, faturas e projeções |
| `src/lib/repository.ts` | Persistência Supabase e armazenamento local da demonstração |
| `src/lib/supabase.ts` | Configuração do cliente, sessão e diagnóstico de autenticação |
| `supabase/migrations/` | Histórico de migrations PostgreSQL |
| `supabase/setup.sql` | SQL consolidado para instalação inicial |
| `vercel.json` | Redirecionamento interno para rotas da aplicação |

## Desenvolvimento local

Use Node.js 22.12+ ou 24 LTS.

```sh
npm ci
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). O botão **Abrir demonstração local** abre `/demo`, com dados fictícios editáveis. As alterações da demonstração ficam no navegador. O build de produção exige autenticação para acessar os módulos financeiros.

Use `.env.example` como referência para preencher `.env.local`. O ambiente está no `.gitignore`. Reinicie o Vite após alterar as variáveis.

| Variável | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave **Publishable** (prefixo `sb_publishable_`) |
| `VITE_APP_URL` | Origem da aplicação, como `http://localhost:5173` |
| `VITE_APP_NAME` | Nome de exibição, como `Meu Financeiro` |

A URL e a chave publicável estão disponíveis em **Settings → API Keys** ou no diálogo **Connect** do Supabase. As variáveis com prefixo `VITE_` são públicas no navegador. Guarde o Client Secret do Google somente nas configurações do provedor Google do Supabase. Reserve as chaves administrativas para operações fora do frontend.

## Banco de dados no Supabase

Em um projeto Supabase novo, escolha um dos caminhos abaixo para instalar o esquema. Se estiver reutilizando uma instalação, confira o histórico de migrations do projeto antes de aplicar mudanças.

- **SQL Editor**. Abra `supabase/setup.sql`, copie seu conteúdo para uma nova consulta e execute uma vez. Se for passar a usar o CLI depois, registre as versões correspondentes como aplicadas com `supabase migration repair <versão> --status applied` após verificar que o esquema está completo.
- **Supabase CLI**. Use `supabase init` se o repositório ainda não tiver configuração local, autentique o CLI e execute os comandos abaixo. Confira o destino e a lista da simulação antes de aplicar.

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push --dry-run
supabase db push
```

As tabelas financeiras usam IDs UUID, chaves estrangeiras que incluem o proprietário, índices por usuário e período, timestamps e RLS. Sessões anônimas ficam sem acesso. Sessões autenticadas leem e alteram somente registros próprios e precisam ter entrado por OAuth com a identidade Google vinculada. As categorias iniciais são cadastradas na primeira sessão autorizada.

## Google OAuth

1. No Google Cloud, configure o **Google Auth Platform** com Branding, Audience e Data Access. Se usar **Testing**, adicione os dois e-mails que usará no teste de aceitação como test users do Google. Na validação do Supabase, apenas um deles deve estar cadastrado no Supabase Auth.
2. Em **Clients**, crie um cliente OAuth do tipo **Web application**. Cadastre como **Authorized redirect URI** a URL de callback exibida pelo Supabase no painel do provedor Google, no formato `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`.
3. No Supabase, acesse **Authentication → Sign In / Providers**. Desligue **Allow new users to sign up**, **Allow anonymous sign-ins** e **Allow manual linking**. Desabilite Email, Phone e quaisquer outros provedores. Habilite **Google**, informe Client ID e Client Secret e mantenha a verificação de nonce e de e-mail do provedor.
4. Em **Authentication → URL Configuration**, informe a origem principal em **Site URL**. Em **Redirect URLs**, inclua `http://localhost:5173/auth/callback` para desenvolvimento e `https://SEU-DOMINIO/auth/callback` para publicação. Abra o aplicativo na mesma origem de `VITE_APP_URL` para manter o verificador PKCE disponível no retorno.

[Configurar Google no Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) · [Configurações de autenticação](https://supabase.com/docs/guides/auth/general-configuration) · [URLs de redirecionamento](https://supabase.com/docs/guides/auth/redirect-urls)

### Autorizar uma conta Google

1. Confirme por um canal confiável o e-mail completo da conta Google que deseja autorizar, incluindo domínio e eventuais aliases. Use o e-mail retornado pelo Google.
2. Em **Authentication → Users → Add user → Create new user**, crie o usuário com esse e-mail e marque **Auto Confirm User** após verificar sua titularidade. Se o painel exigir senha, gere uma senha aleatória forte exclusiva para esse cadastro e mantenha o provedor Email desabilitado. É possível também usar `auth.admin.createUser({ email, email_confirm: true })` a partir de um ambiente administrativo local confiável.
3. Peça que o usuário abra o aplicativo e clique em **Entrar com Google**. O Supabase vincula automaticamente a identidade Google de e-mail verificado ao usuário existente. Confira no painel se o mesmo UUID ganhou a identidade `google`. Mantenha a vinculação manual desabilitada e use o fluxo normal de OAuth para comprovar a identidade.

[Vinculação de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking) · [Criação administrativa de usuários](https://supabase.com/docs/reference/javascript/auth-admin-createuser)

### Aceitação de autenticação

- Entre com a conta previamente criada. Confirme a identidade Google associada, cadastre um lançamento e recarregue a página. O lançamento e a sessão devem permanecer. Feche e reabra a mesma origem no mesmo perfil do navegador para verificar a persistência da sessão.
- Em janela anônima, tente entrar com outro e-mail Google que ainda não exista em **Authentication → Users**. A aplicação deve informar **Sua conta não possui autorização para acessar este sistema**. Confirme que o e-mail continua ausente da lista de usuários. Se o Google estiver em **Testing**, ambas as contas precisam estar nos test users do Google para que a segunda chegue ao Supabase.
- Sem sessão, abra uma rota interna como `/calendario`. A tela de login deve aparecer. Execute os testes locais para verificar o isolamento de dados entre proprietários e a rejeição de acesso anônimo no PostgreSQL.

## Regras da projeção

- O saldo inicial da conta é uma fotografia no começo da data de referência. Movimentos anteriores vinculados à conta já estão refletidos nessa fotografia. Transferências debitam a origem e creditam o destino sem alterar o total consolidado.
- O saldo realizado usa as datas efetivas. Na projeção, pendências futuras entram na data prevista e as vencidas são projetadas para hoje, com a data original preservada nos lançamentos.
- A sobra mensal é receitas menos despesas. O saldo acumulado também inclui o saldo trazido e os saldos iniciais de contas incorporadas ao período.
- Recorrências são calculadas a partir de regras. Alterações individuais, confirmações e exclusões são armazenadas como exceções. A opção **Este lançamento e os próximos** encerra o trecho anterior e cria uma nova regra em uma operação atômica. Os registros confirmados mantêm seus valores e datas efetivas.
- As parcelas são derivadas das compras. O fechamento determina a primeira fatura sugerida, e centavos remanescentes são distribuídos nas primeiras parcelas. No fluxo de caixa, a fatura entra uma vez, no vencimento ou na data efetiva de pagamento.
- Para conciliar uma fatura manual, registre o total e depois adicione as compras. Enquanto a conciliação estiver aberta, a projeção usa o maior valor entre o total manual e a soma dos itens. Depois de concluir a conciliação, usa a soma detalhada. O pagamento confirmado guarda o total e as datas da fatura.
- A simulação usa uma cópia dos dados no navegador e grava uma despesa somente após **Registrar despesa**.

## Testes e build

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Os testes financeiros cobrem saldo diário, saldo negativo, passagem de saldo entre meses, transferências, vencidos, recorrências e exceções, centavos, datas de fatura, conciliação, pagamentos e simulação. Os testes de banco executam o SQL no PostgreSQL local via PGlite e verificam RLS, integridade dos vínculos e a divisão atômica de recorrências.

## Publicar na Vercel

1. Envie os arquivos do projeto para um repositório Git, incluindo o `.env.example` e o `package-lock.json`. Use um projeto pessoal no plano Hobby da Vercel.
2. Importe o repositório e escolha o preset **Vite**. Use `npm run build` como comando e `dist` como diretório de saída. O `vercel.json` já redireciona rotas internas para a aplicação.
3. Defina as quatro variáveis públicas no projeto da Vercel. Use o domínio publicado em `VITE_APP_URL`. Cadastre o callback do domínio em **Redirect URLs** no Supabase e publique novamente após alterar as variáveis.
4. Repita os testes de autenticação no domínio publicado.

[Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite) · [Redirecionamentos do Supabase Auth](https://supabase.com/docs/guides/auth/redirect-urls)
