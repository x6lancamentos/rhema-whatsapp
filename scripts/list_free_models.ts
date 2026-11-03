async function listFree() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const d = await res.json();
  const free = d.data.filter((m: any) => m.id.endsWith(":free")).map((m: any) => ({ id: m.id, name: m.name }));
  console.log("FREE MODELS (" + free.length + "):");
  for (const f of free) {
    console.log(`- ${f.id} (${f.name})`);
  }
}
listFree().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

