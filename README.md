# doreemuwwwwin

Instagram のDMに自動で返信するサーバーです(Instagram 公式 Messaging API 使用)。

## 仕組み
1. 誰かがDMを送る → Meta が `/webhook` に通知
2. `rules.json` のキーワードに一致すれば、その返信を送信
3. 一致しなければ、`ANTHROPIC_API_KEY` があればClaudeが返信、なければ `defaultReply` を送信

## 事前準備(Meta側)
- Instagramアカウントを **プロフェッショナル(ビジネス/クリエイター)** アカウントにする
- [Meta for Developers](https://developers.facebook.com/) でアプリを作成し、「Instagram」製品を追加
- 権限 `instagram_business_manage_messages` を有効化し、アクセストークンを発行
- Webhook の購読で `messages` を選択し、コールバックURLに `https://<公開URL>/webhook`、確認トークンに `VERIFY_TOKEN` を設定
- 開発中は自分のテストユーザーのみ。一般ユーザーへの返信には **アプリレビュー(Advanced Access)** が必要

## 起動
```
cp .env.example .env   # 値を記入
npm start
```
ローカル確認には `ngrok http 3000` などで公開URLを作ってください。

## 自分から送る(送信コマンド)
サーバーが受信した相手を `data/contacts.json` に記録します。24時間以内にDMをくれた相手にだけ送れます。
```
npm run send -- list                    # 送信可能な相手の一覧 (ID・経過時間・最後のメッセージ)
npm run send -- <相手のID> "本文"        # 送信
```

## 注意
- 返信できるのは、相手の最後のメッセージから **24時間以内** のみ(Instagramの仕様)
- 非公式ツールによる自動操作はアカウント凍結のリスクがあるため、公式APIのみを使っています
