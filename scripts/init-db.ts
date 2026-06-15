import { getStore } from "../src/lib/ghost";

async function main() {
  await getStore().initSchema();
  console.log("Ghost schema initialized.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
