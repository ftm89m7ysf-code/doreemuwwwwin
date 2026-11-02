// 使い方:
//   npm run send -- list                  24時間以内にDMをくれた相手の一覧
//   npm run send -- <相手のID> "本文"      その相手に送信
import { loadContacts, sendMessage, WINDOW_MS } from "./lib.js";

const [target, ...rest] = process.argv.slice(2);
const contacts = loadContacts();

if (!target || target === "list") {
  const open = Object.entries(contacts).filter(([, c]) => Date.now() - c.lastMessageAt < WINDOW_MS);
  if (!open.length) console.log("24時間以内にDMをくれた相手はいません。");
  for (const [id, c] of open) {
    const h = ((Date.now() - c.lastMessageAt) / 3600000).toFixed(1);
    console.log(`${id}\t${h}時間前\t${c.lastText}`);
  }
  process.exit(0);
}

const text = rest.join(" ");
if (!text) {
  console.error('本文を指定してください: npm run send -- <ID> "本文"');
  process.exit(1);
}
const contact = contacts[target];
if (!contact || Date.now() - contact.lastMessageAt >= WINDOW_MS) {
  console.error("この相手は24時間以内にDMをくれていないため送信できません (Instagramの仕様)。");
  process.exit(1);
}
try {
  await sendMessage(target, text);
  console.log("送信しました。");
} catch (err) {
  console.error("送信に失敗:", err.cause?.message ?? err.message);
  process.exit(1);
}
