import { prisma } from "../src/lib/prisma";

async function run() {
  const tables: any = await prisma.$queryRawUnsafe(
    `SELECT table_schema, table_name 
     FROM information_schema.tables 
     WHERE table_name ILIKE '%ficha%' OR table_name ILIKE '%imovel%'`
  );
  console.log("TABELAS ENCONTRADAS:", tables);
  process.exit(0);
}
run();
