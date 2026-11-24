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
| `VITE_APP_NAME` | Nome de exibição, como `Meu Financeiro` |

A URL e a chave publicável estão disponíveis em **Settings → API Keys** ou no diálogo **Connect** do Supabase. As variáveis com prefixo `VITE_` são públicas no navegador. Reserve as chaves administrativas para operações fora do frontend.

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

As tabelas financeiras usam IDs UUID, chaves estrangeiras que incluem o proprietário, índices por usuário e período, timestamps e RLS. Sessões iniciadas com e-mail e senha leem e alteram somente registros próprios. As categorias iniciais são cadastradas na primeira sessão autorizada.

## Login por e-mail e senha

1. Em **Authentication → Sign In / Providers**, deixe **Email** habilitado e desative **Allow new users to sign up**, **Allow anonymous sign-ins** e os demais provedores.
2. Em **Authentication → Users → Add user → Create new user**, cadastre o e-mail e defina uma senha exclusiva. Marque **Auto Confirm User** apenas para endereços cuja titularidade foi verificada. Para uma conta já existente, mantenha o mesmo usuário para preservar o UUID e os dados associados.
3. Acesse o aplicativo com a conta criada. As políticas do banco verificam se a sessão foi iniciada por senha e restringem o acesso aos registros do próprio usuário.

[Login por senha no Supabase](https://supabase.com/docs/guides/auth/passwords) · [Criação administrativa de usuários](https://supabase.com/docs/reference/javascript/auth-admin-createuser)

### Validação do acesso

- Entre com a conta criada no painel e recarregue a página para verificar a sessão. Confira se os lançamentos da conta estão disponíveis.
- Em janela anônima, abra uma rota interna como `/calendario` e confira se a tela de login aparece. Uma tentativa com credenciais inválidas deve receber uma mensagem genérica.
- Os testes locais verificam o isolamento entre proprietários, a preservação dos dados na migração e a rejeição de sessões anônimas ou sem senha de e-mail.

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
3. Defina as variáveis públicas do `.env.example` no projeto da Vercel e publique novamente após alterá-las.
4. Repita os testes de autenticação no domínio publicado.

[Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite)
