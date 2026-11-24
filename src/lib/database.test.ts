import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const owner = '10000000-0000-4000-a000-000000000001'
const other = '10000000-0000-4000-a000-000000000002'
const database = new PGlite()

async function authenticate(user: string, method = 'oauth', anonymous = false) {
  await database.exec('reset role')
  await database.query('select set_config($1, $2, false)', ['request.jwt.claims', JSON.stringify({
    sub: user, app_metadata: { providers: ['email', 'google'] }, amr: [{ method }], is_anonymous: anonymous,
  })])
  await database.exec('set role authenticated')
}

beforeAll(async () => {
  await database.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as
      'select nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb';
    create function auth.uid() returns uuid language sql stable as 'select (auth.jwt()->>''sub'')::uuid';
    grant usage on schema auth to anon, authenticated;
    insert into auth.users values ('${owner}'), ('${other}');
  `)
  await database.exec(await readFile('supabase/setup.sql', 'utf8'))
  await authenticate(owner)
  await database.exec("select public.initialize_finance(); insert into public.accounts(name,opening_balance,opening_date) values ('Owner', 50000, '2026-01-01')")
}, 15000)
afterAll(async () => { await database.close() })

describe('Segurança e integridade no PostgreSQL', () => {
  it('inicializa categorias uma vez e isola leitura e atualização por usuário', async () => {
    await authenticate(owner)
    await database.exec('select public.initialize_finance()')
    expect((await database.query('select name from public.categories')).rows).toHaveLength(15)
    await authenticate(other)
    expect((await database.query('select * from public.categories')).rows).toHaveLength(0)
    expect((await database.query('select * from public.accounts')).rows).toHaveLength(0)
    expect((await database.query("update public.accounts set name='Cross owner' returning id")).rows).toHaveLength(0)
    await expect(database.query('insert into public.accounts(user_id,name,opening_balance,opening_date) values ($1,$2,0,$3)', [owner,'No','2026-01-01']))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('bloqueia visitante, sessão anônima e login por senha, inclusive com uma identidade Google vinculada', async () => {
    await database.exec('reset role; set role anon')
    await expect(database.query('select * from public.accounts')).rejects.toMatchObject({ code: '42501' })
    await authenticate(owner, 'password')
    expect((await database.query('select * from public.accounts')).rows).toHaveLength(0)
    await authenticate(owner, 'oauth', true)
    expect((await database.query('select * from public.accounts')).rows).toHaveLength(0)
  })

  it('rejeita vínculo de lançamento com conta de outro proprietário', async () => {
    await authenticate(owner)
    const { rows } = await database.query<{ id: string }>('select id from public.accounts')
    await authenticate(other)
    await expect(database.query(
      "insert into public.transactions(description,kind,amount,planned_date,account_id) values ('Teste','expense',100,'2026-01-01',$1)", [rows[0].id],
    )).rejects.toMatchObject({ code: '23503' })
  })

  it('divide recorrências atomicamente e mantém a confirmação associada à nova data', async () => {
    await authenticate(owner)
    const { rows } = await database.query<{ id: string }>(`
      insert into public.recurring_transactions(description,kind,amount,start_date,frequency)
      values ('Internet','expense',10000,'2026-01-05','monthly') returning id
    `)
    const parent = rows[0].id
    await database.query(`insert into public.recurrence_exceptions
        (recurrence_id,description,kind,amount,planned_date,occurrence_date,status,effective_date)
        values ($1,'Internet','expense',10000,'2026-03-05','2026-03-05','paid','2026-03-04')`, [parent])
    const replacement = { id: crypto.randomUUID(), description: 'Internet', kind: 'expense', amount: 12000,
      method: '', notes: '', start_date: '2026-02-06', active: true, frequency: 'monthly' }
    await expect(database.query('select public.split_finance_recurrence($1,$2,$3,$4)', [
      parent, '2026-02-05', { ...replacement, amount: -1 }, {},
    ])).rejects.toMatchObject({ code: '23514' })
    expect((await database.query('select active, stop_before from public.recurring_transactions where id=$1', [parent])).rows)
      .toEqual([{ active: true, stop_before: null }])
    await database.query('select public.split_finance_recurrence($1,$2,$3,$4)', [
      parent, '2026-02-05', replacement, { '2026-03-05': '2026-03-06' },
    ])
    expect((await database.query('select recurrence_id, occurrence_date::text, effective_date::text from public.recurrence_exceptions')).rows)
      .toEqual([{ recurrence_id: replacement.id, occurrence_date: '2026-03-06', effective_date: '2026-03-04' }])
  })
})
