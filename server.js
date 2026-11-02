// Instagram DM 自動返信サーバー (Instagram Messaging API / Webhook)
// 依存パッケージなし。Node.js 18+ が必要です。
import http from "node:http";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { sendMessage, recordInbound } from "./lib.js";

const {
  PORT = "3000",
  VERIFY_TOKEN,
  APP_SECRET,
  IG_ACCESS_TOKEN,
  GRAPH_VERSION = "v21.0",
  ANTHROPIC_API_KEY, // 設定すると、ルールに合わない時だけAIが返信する
  AI_MODEL = "claude-sonnet-5-5",
  AI_SYSTEM_PROMPT = "あなたはInstagramアカウントの問い合わせ対応担当です。丁寧で簡潔な日本語で、200文字以内で返信してください。",
} = process.env;

for (const [k, v] of Object.entries({ VERIFY_TOKEN, APP_SECRET, IG_ACCESS_TOKEN })) {
  if (!v) {
    console.error(`環境変数 ${k} が未設定です (.env.example を参照)`);
    process.exit(1);
  }
}

const { rules, defaultReply } = JSON.parse(
  readFileSync(new URL("./rules.json", import.meta.url), "utf8"),
);

function verifySignature(rawBody, header) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const given = header.slice("sha256=".length);
  return (
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  );
}

async function aiReply(text) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 400,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.find((b) => b.type === "text")?.text?.trim() || null;
}

async function decideReply(text) {
  const lower = text.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) return rule.reply;
  }
  if (ANTHROPIC_API_KEY) {
    try {
      const reply = await aiReply(text);
      if (reply) return reply;
    } catch (err) {
      console.error("AI返信に失敗。デフォルト返信を使います:", err.message);
    }
  }
  return defaultReply;
}

async function handleEvent(body) {
  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const text = ev.message?.text;
      // 自分自身の送信(echo)や、テキスト以外は無視 (無限ループ防止)
      if (!text || ev.message.is_echo || ev.sender.id === entry.id) continue;
      recordInbound(ev.sender.id, text);
      try {
        await sendMessage(ev.sender.id, await decideReply(text));
      } catch (err) {
        console.error("返信に失敗:", err.message);
      }
    }
  }
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/webhook") {
      res.writeHead(404).end();
      return;
    }

    // Meta のWebhook登録時の検証
    if (req.method === "GET") {
      if (
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === VERIFY_TOKEN
      ) {
        res.writeHead(200).end(url.searchParams.get("hub.challenge"));
      } else {
        res.writeHead(403).end();
      }
      return;
    }

    if (req.method === "POST") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks);
        if (!verifySignature(raw, req.headers["x-hub-signature-256"])) {
          res.writeHead(401).end();
          return;
        }
        res.writeHead(200).end("ok"); // 先に200を返し、処理は非同期で行う
        try {
          handleEvent(JSON.parse(raw.toString("utf8")));
        } catch (err) {
          console.error("不正なペイロード:", err.message);
        }
      });
      return;
    }

    res.writeHead(405).end();
  })
  .listen(Number(PORT), () => console.log(`listening on :${PORT}  (POST/GET /webhook)`));
