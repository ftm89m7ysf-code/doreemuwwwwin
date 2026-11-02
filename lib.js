import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const { IG_ACCESS_TOKEN, GRAPH_VERSION = "v21.0" } = process.env;

export const WINDOW_MS = 24 * 60 * 60 * 1000;
const CONTACTS_PATH = new URL("./data/contacts.json", import.meta.url);

export async function sendMessage(recipientId, text) {
  const res = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/me/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${IG_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  if (!res.ok) throw new Error(`Send API ${res.status}: ${await res.text()}`);
}

export function loadContacts() {
  return existsSync(CONTACTS_PATH) ? JSON.parse(readFileSync(CONTACTS_PATH, "utf8")) : {};
}

function saveContacts(contacts) {
  mkdirSync(new URL("./data/", import.meta.url), { recursive: true });
  writeFileSync(CONTACTS_PATH, JSON.stringify(contacts, null, 2));
}

// 相手から受信した時刻を記録 (24時間ウィンドウの判定用)
export function recordInbound(id, text) {
  const contacts = loadContacts();
  contacts[id] = { lastMessageAt: Date.now(), lastText: text.slice(0, 80) };
  saveContacts(contacts);
}
