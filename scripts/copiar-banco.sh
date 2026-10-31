#!/bin/sh
# Copia o banco de produção do Neon para o PlanetScale Postgres (#177).
#
# Lê ORIGEM_URL (o Neon) e DESTINO_URL (o PlanetScale) do ambiente ou do arquivo
# .env.migracao, fora do Git, com os valores entre aspas. Use as conexões
# diretas: no Neon, a DATABASE_URL_UNPOOLED (sem "-pooler" no host); no
# PlanetScale, a da porta 5432. O pg_dump precisa ser da versão do Postgres da
# origem ou mais novo: o Neon e o PlanetScale estão no 18, e o libpq do Homebrew
# traz os programas do 18 (PATH="$(brew --prefix libpq)/bin:$PATH").
#
#   npm run banco:copiar                    copia e confere as contagens
#   npm run banco:copiar -- --conferir      só confere as contagens
#   npm run banco:copiar -- --congelar      deixa a origem só para leitura
#   npm run banco:copiar -- --descongelar   devolve a escrita à origem
#
# A cópia apaga e recria no destino as tabelas que vêm da origem (pg_restore
# --clean), numa transação só: se algo falha, o destino fica como estava. Pode
# rodar quantas vezes precisar; a cópia do ensaio é substituída pela da troca.
#
# Na troca, congele a origem antes da cópia final. O site continua abrindo, mas
# o que grava no banco (login, cadastro, edição) mostra a página de erro até o
# Worker apontar para o destino. Para voltar atrás, descongele.
set -e

if [ -f .env.migracao ]; then
  set -a
  . ./.env.migracao
  set +a
fi

for programa in pg_dump pg_restore psql; do
  if ! command -v "$programa" > /dev/null; then
    echo "Falta o $programa. No Mac: brew install libpq e PATH=\"\$(brew --prefix libpq)/bin:\$PATH\"." >&2
    exit 1
  fi
done

if [ -z "$ORIGEM_URL" ] || [ -z "$DESTINO_URL" ]; then
  echo "Falta ORIGEM_URL ou DESTINO_URL. Configure no ambiente ou no .env.migracao." >&2
  exit 1
fi

host() { printf '%s' "$1" | sed -E 's|^[a-z]+://([^@]*@)?([^:/?]+).*|\2|'; }
ORIGEM_HOST=$(host "$ORIGEM_URL")
DESTINO_HOST=$(host "$DESTINO_URL")

# Trocar as duas variáveis de lugar apagaria o banco de produção.
if [ "$ORIGEM_HOST" = "$DESTINO_HOST" ]; then
  echo "A origem e o destino são o mesmo servidor ($ORIGEM_HOST)." >&2
  exit 1
fi
case "$DESTINO_HOST" in
  *neon.tech)
    echo "O destino ($DESTINO_HOST) é um Neon. Confira se ORIGEM_URL e DESTINO_URL não estão trocadas." >&2
    exit 1
    ;;
esac

versao() { psql "$1" -At -v ON_ERROR_STOP=1 -c 'show server_version'; }

# Uma linha "tabela total" por tabela do schema public, em ordem.
contar() {
  psql "$1" -At -v ON_ERROR_STOP=1 <<'SQL' | sort
select format('select %L || '' '' || count(*) from public.%I', tablename, tablename)
from pg_tables where schemaname = 'public'
\gexec
SQL
}

conferir() {
  dir=$(mktemp -d)
  contar "$ORIGEM_URL" > "$dir/origem"
  contar "$DESTINO_URL" > "$dir/destino"
  echo "Linhas por tabela (origem):"
  sed 's/^/  /' "$dir/origem"
  if diff "$dir/origem" "$dir/destino" > "$dir/diferencas"; then
    echo "O destino tem as mesmas tabelas e o mesmo número de linhas."
    rm -rf "$dir"
  else
    echo "O destino está diferente da origem (< origem, > destino):" >&2
    sed 's/^/  /' "$dir/diferencas" >&2
    rm -rf "$dir"
    exit 1
  fi
  DATABASE_URL="$DESTINO_URL" npx prisma migrate status
}

congelar() {
  psql "$ORIGEM_URL" -At -v ON_ERROR_STOP=1 <<'SQL'
select format('alter database %I set default_transaction_read_only = on', current_database())
\gexec
-- A configuração só vale para conexões novas: as abertas são encerradas e
-- reconectam já só para leitura.
select count(pg_terminate_backend(pid)) || ' conexões encerradas'
from pg_stat_activity
where datname = current_database() and pid <> pg_backend_pid() and usename = current_user;
SQL
  echo "Origem só para leitura: $(psql "$ORIGEM_URL" -At -c 'show default_transaction_read_only')"
}

descongelar() {
  psql "$ORIGEM_URL" -At -v ON_ERROR_STOP=1 <<'SQL'
set default_transaction_read_only = off;
select format('alter database %I reset default_transaction_read_only', current_database())
\gexec
SQL
  echo "Origem só para leitura: $(psql "$ORIGEM_URL" -At -c 'show default_transaction_read_only')"
}

copiar() {
  dir=$(mktemp -d)
  # O arquivo tem os dados pessoais de quem usa o site: não sobra nada no disco.
  trap 'rm -rf "$dir"' EXIT
  pg_dump "$ORIGEM_URL" --format=custom --schema=public --no-owner --no-privileges --file "$dir/banco.dump"
  # O schema public já existe no destino; criá-lo de novo faria o restore falhar.
  pg_restore --list "$dir/banco.dump" | grep -v -E ' (COMMENT - )?SCHEMA (- )?public( |$)' > "$dir/itens"
  pg_restore --dbname "$DESTINO_URL" --use-list "$dir/itens" --clean --if-exists \
    --no-owner --no-privileges --single-transaction "$dir/banco.dump"
  psql "$DESTINO_URL" -q -v ON_ERROR_STOP=1 -c 'analyze'
}

echo "Origem:  $ORIGEM_HOST (Postgres $(versao "$ORIGEM_URL"))"
echo "Destino: $DESTINO_HOST (Postgres $(versao "$DESTINO_URL"))"
echo

case "$1" in
  --conferir) conferir ;;
  --congelar) congelar ;;
  --descongelar) descongelar ;;
  "")
    copiar
    echo "Cópia feita."
    conferir
    ;;
  *)
    echo "Opção desconhecida: $1" >&2
    exit 1
    ;;
esac
