import { readFileSync, readdirSync, statSync } from "node:fs";
import { Client } from "pg";
import { gerarHashSenha } from "@/lib/auth/senha";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { conferirDestino, limparSaida } from "./isolamento";

describe("proof isolation", () => {
  const local = "postgresql://fixture:synthetic@127.0.0.1:49152/ndb_auth_test_ab12";
  it("accepts only the exact resource created by the fixture", () => {
    expect(() => conferirDestino(local, local)).not.toThrow();
    for (const value of [undefined, local.replace("49152", "5433"), local.replace("127.0.0.1", "remote.example"), local.replace("test_ab12", "test_cd34"), local + "?sslmode=require"]) {
      expect(() => conferirDestino(value, local)).toThrow();
    }
    expect(() => conferirDestino(local.replace("49152", "5433"), local.replace("49152", "5433"))).toThrow();
  });
  it("removes recorded Prisma URL fragments and cookie lines", () => {
    const recorded = 'Datasource "db": PostgreSQL database "ndb_auth_test_ab12" at "127.0.0.1:49152"\nConnection failed: postgresql://fixture:synthetic@127.0.0.1:49152/ndb_auth_test_ab12\nSet-Cookie: ndb_sessao=synthetic-token\npostgresql://fixture:synth';
    const safe = limparSaida(recorded, ["synthetic"]);
    expect(safe).not.toContain("postgresql://");
    expect(safe).not.toContain("synthetic-token");
    expect(safe).not.toContain("fixture:synth");
  });
});

describe("additive Better Auth storage", () => {
  it("pins the current exact release", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(pkg.dependencies["better-auth"]).toBe("1.7.14");
  });
  it("preserves populated legacy identities, roles, memberships, testimonials, and session IDs", async () => {
    const url = process.env.TEST_DATABASE_URL!;
    conferirDestino(url, url);
    const cliente = new Client({ connectionString: url });
    await cliente.connect();
    const nome = "prova_auth_migracao";
    let criou = false;
    try {
      await cliente.query(`CREATE SCHEMA "${nome}"`);
      criou = true;
      await cliente.query(`SET search_path TO "${nome}"`);
      const pasta = new URL("../../prisma/migrations/", import.meta.url);
      const migracao = "20261101063000_prova_better_auth";
      function sql(diretorio: string) {
        const arquivo = new URL(`${diretorio}/migration.sql`, pasta);
        expect(statSync(arquivo).size).toBeLessThan(64 * 1024);
        return readFileSync(arquivo, "utf8");
      }
      for (const entrada of readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== migracao).sort((a, b) => a.name.localeCompare(b.name))) {
        await cliente.query(sql(entrada.name));
      }
      const hash = await gerarHashSenha("public-fixture-password");
      await cliente.query(`INSERT INTO "Usuario" (id, nome, email, "senhaHash", papel, "emailConfirmadoEm", "googleId") VALUES
        ('legacy-mod', 'Pessoa Mod', 'mod@example.test', $1, 'moderador', CURRENT_TIMESTAMP, 'google-legacy'),
        ('legacy-unconfirmed', 'Pessoa Membro', 'member@example.test', $1, 'membro', NULL, NULL)`, [hash]);
      await cliente.query(`INSERT INTO "Empresa" (id, "instagramUsername", nome, resumo, categoria, cidade, uf, "atualizadoEm") VALUES ('legacy-business', 'legacy.example', 'Negócio', 'Resumo', 'outros', 'São Paulo', 'SP', CURRENT_TIMESTAMP)`);
      await cliente.query(`INSERT INTO "EmpresaMembro" ("empresaId", "usuarioId") VALUES ('legacy-business', 'legacy-mod')`);
      await cliente.query(`INSERT INTO "Depoimento" (id, "empresaId", "autorId", texto) VALUES ('legacy-testimonial', 'legacy-business', 'legacy-unconfirmed', 'Depoimento da prova')`);
      await cliente.query(`INSERT INTO "Sessao" (id, "usuarioId", "expiraEm") VALUES ('legacy-session-hash', 'legacy-mod', CURRENT_TIMESTAMP + INTERVAL '30 days')`);
      const antes = {
        usuarios: (await cliente.query('SELECT id, papel, "senhaHash", "emailConfirmadoEm", "googleId" FROM "Usuario" ORDER BY id')).rows,
        membros: (await cliente.query('SELECT * FROM "EmpresaMembro"')).rows,
        depoimentos: (await cliente.query('SELECT * FROM "Depoimento"')).rows,
        sessoes: (await cliente.query('SELECT id, "usuarioId", "expiraEm", "criadoEm" FROM "Sessao"')).rows,
      };
      await cliente.query(sql(migracao));
      const depois = {
        usuarios: (await cliente.query('SELECT id, papel, "senhaHash", "emailConfirmadoEm", "googleId" FROM "Usuario" ORDER BY id')).rows,
        membros: (await cliente.query('SELECT * FROM "EmpresaMembro"')).rows,
        depoimentos: (await cliente.query('SELECT * FROM "Depoimento"')).rows,
        sessoes: (await cliente.query('SELECT id, "usuarioId", "expiraEm", "criadoEm" FROM "Sessao"')).rows,
      };
      expect(JSON.stringify(depois) === JSON.stringify(antes)).toBe(true);
      expect((await cliente.query('SELECT "emailVerificado" FROM "Usuario" ORDER BY id')).rows).toEqual([{ emailVerificado: true }, { emailVerificado: false }]);
      expect((await cliente.query('SELECT token FROM "Sessao"')).rows).toEqual([{ token: null }]);
      const credenciais = (await cliente.query('SELECT "usuarioId", senha FROM "VinculoAuth" WHERE "provedorId" = $1 ORDER BY "usuarioId"', ["credential"])).rows;
      expect(credenciais.length === 2 && credenciais.every((c) => c.senha === hash)).toBe(true);
      expect((await cliente.query('SELECT "contaId", "usuarioId" FROM "VinculoAuth" WHERE "provedorId" = $1', ["google"])).rows).toEqual([{ contaId: "google-legacy", usuarioId: "legacy-mod" }]);
    } finally {
      await cliente.query('SET search_path TO public');
      if (criou) await cliente.query(`DROP SCHEMA "${nome}" CASCADE`);
      await cliente.end();
    }
  });
  it("adds mapped columns without a parallel user model", async () => {
    const columns = await db.$queryRaw<{ table_name: string; column_name: string; is_nullable: string }[]>`
      SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public'
    `;
    const usuario = columns.filter((c) => c.table_name === "Usuario").map((c) => c.column_name);
    const sessao = columns.filter((c) => c.table_name === "Sessao");
    expect(usuario).toEqual(expect.arrayContaining(["emailVerificado", "atualizadoEm", "imagem"]));
    expect(sessao.map((c) => c.column_name)).toEqual(expect.arrayContaining(["token", "atualizadoEm", "ip", "userAgent"]));
    expect(sessao.find((c) => c.column_name === "token")?.is_nullable).toBe("YES");
    expect(columns.map((c) => c.table_name)).toContain("VinculoAuth");
    expect(columns.map((c) => c.table_name)).toContain("VerificacaoAuth");
    expect(columns.map((c) => c.table_name)).not.toContain("User");
    expect(columns.map((c) => c.table_name)).not.toContain("UsuarioAuth");
  });
});

afterAll(() => db.$disconnect());
