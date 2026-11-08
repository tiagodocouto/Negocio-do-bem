import { URL_BANCO_TESTE } from "./banco-de-teste";

process.env.DATABASE_URL = URL_BANCO_TESTE;
// O ambiente herdado nunca escolhe um armazenamento externo para a suíte.
delete process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
