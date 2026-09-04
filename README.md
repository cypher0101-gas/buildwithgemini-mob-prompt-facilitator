# モブプロンプト・アリーナ (Mob Prompt Arena) 🚀

Google Cloud ADK / Gemini 2.5 活用型・モブプロンプティング体験・ファシリテーションAIエージェント＆リアルタイムWebUI

## 📌 概要

「モブプロンプト・アリーナ」は、複数人の参加者が同じWebチャットルーム（アリーナ）に集まり、プロンプトの工夫やアイデア出しをしながら対話を行うリアルタイム共有空間です。
ファシリテーターAIエージェントが各メンバーの発言やアイデアの質をリアルタイムにレビューし、的確なツッコミや深掘り質問（Grill Time）、バッジ進呈（ノウハウ表彰）、決定事項のロック保存および議題バックログの管理を行います。

---

## 🛠️ 主な機能

- 💬 **グループチャット＆マルチタブ参加**: `?user=ジェミ助` や `?user=ミニー` などのURLパラメータで別タブから複数人として同時参加可能。
- 🏆 **バッジ進呈システム & 図鑑（アコーディオン）**:
  - `技術知性 (Tech Architect)`
  - `アイデアモンスター (Idea Monster)`
  - `クリティカルシンカー (Critical Thinker)`
  - `仕様ドッキング (Spec Finisher)`
  - `アリーナMVP (Arena MVP)`
- 📜 **メンバー発言履歴 & バッジ記録モーダル**: メンバーの過去の発言や、どの発言でバッジを獲得したかを追跡。
- 📌 **板書・バックログ（シャッタードロワー）**:
  - 画面上部から開閉するシャッター式ドロワー。
  - 下辺の中央グリップバーをドラッグ＆ドロップして、高さを自由に縦伸縮調整可能。
  - 議論中テーマ、確定仕様（🔒 南京錠マーク付き）、議題バックログ（「🚀 引き出して議論開始」ボタン付き）を自動同期。
- 🗣️ **エージェント吹き出しの分離**:
  - 💬 **フィードバック＆レビュー**（メンバーの発言に対する技術コメントやアイデア評価）
  - 🔥 **Grill Time**（議題を確定させるための深掘り質問・トレードオフ提示）

---

## 📁 フォルダ構成

```
mob-prompt-facilitator/
├── app/                        # エージェントコアロジック
│   ├── agent.py               # ファシリテーターAgent定義・Tools (award_badge, set_active_topic)
│   ├── state.py               # リアルタイム状態管理 (BoardStore, SSE Broadcast)
│   └── fast_api_app.py        # ADK API & A2A エンドポイント
├── frontend/                   # カスタムWebUIサーバー
│   ├── server.py              # SSEマルチユーザー同期対応 FastAPI サーバー
│   └── static/                # WebUI アセット (index.html, style.css, app.js)
├── project_brief.md           # 要件定義書・プロジェクトブリーフ
├── implementation_plan.md     # アーキテクチャ詳細設計書
├── walkthrough.md             # 実装・検証成果まとめ
└── pyproject.toml             # 依存関係定義
```

---

## 🚀 ローカルでの起動方法

依存関係のインストール：
```bash
uv sync
```

WebUI サーバーの起動：
```bash
GOOGLE_GENAI_USE_VERTEXAI=true GOOGLE_CLOUD_PROJECT=<YOUR_PROJECT_ID> uv run python frontend/server.py
```

ブラウザでアクセス：
- ジェミ助さんでアクセス: `http://127.0.0.1:8080/?user=ジェミ助`
- ミニーさんでアクセス: `http://127.0.0.1:8080/?user=ミニー`

---

## ☁️ デプロイ (Agent Platform)

エージェントの Agent Runtime へのデプロイ：
```bash
agents-cli deploy --no-confirm-project --project <YOUR_PROJECT_ID>
```
