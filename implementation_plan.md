# モブプロンプティング・グループチャット（掲示板形式）エージェント＆WebUI 実装計画

複数人の参加者が同一のURLに接続し、グループチャット（掲示板形式）でアイデア出しや要件定義の議論を行いながら、AIエージェント（`MobPromptFacilitator`）が議論をファシリテーションし、メンバーの貢献（鋭いツッコミ、優れたアイデア、アーキテクチャ提案等）に対してリアルタイムにバッジを進呈するWebアプリケーションを構築します。

---

## ユーザー確認・検討事項

> [!IMPORTANT]
> - **同一URLでのマルチユーザー共有**: 本機能は複数人が同じURLにアクセスしてリアルタイムに全員の発言を共有するため、バックエンド（FastAPI）で共有ルーム状態（メッセージ、メンバー一覧、バッジ獲得履歴、合意事項）を管理します。
> - **エージェントの介入タイミング**: ユーザーが発言するたびにエージェントが評価・ファシリテーション（必要に応じてツッコミ、バッジ進呈、要件記録）を行い、全参加者の画面に即時反映されます。

---

## 全体アーキテクチャ概要

```
[ ブラウザ A (参加者1) ] ──┐
[ ブラウザ B (参加者2) ] ──┼──> [ FastAPI サーバー (ポート8080) ]
[ ブラウザ C (参加者3) ] ──┘         │
                                     ├── 共有チャット・メンバー・バッジ状態管理 (In-Memory / SSE)
                                     └── ADK Agent (MobPromptFacilitator)
                                            ├── Gemini 3.6 Flash
                                            ├── tool: award_badge
                                            ├── tool: save_requirement_decision
                                            └── tool: lookup_tech_docs
```

---

## 提案する変更内容

### 1. エージェント側ロジックの強化 ([`mob-prompt-facilitator/app/`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/app))

#### [MODIFY] [`app/agent.py`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/app/agent.py)
- エージェントのプロンプトを「モブプロンプト・ファシリテーター兼レビュアー」に刷新。
- **ツール定義**:
  - `award_badge(member_name: str, badge_name: str, reason: str)`: メンバーにバッジを進呈するツール。
    - バッジ種類:
      - 🎯 **「鋭いツッコミ賞（Sharp Critic）」**: 既存案の穴やクリティカルな課題を指摘した発言
      - 💡 **「ナイスアイデア賞（Idea Spark）」**: 画期的な機能やユニークなアプローチ
      - 🏗️ **「アーキテクト脳賞（Architect Mind）」**: 技術選定やトレードオフを意識した構造的提案
      - 🤝 **「合意形成マスター（Consensus Maker）」**: 意見の対立を整理しチームをまとめた発言
      - 🪄 **「プロンプト職人（Prompt Crafter）」**: LLMの能力を引き出す洗練された指示
  - `save_requirement_decision(topic: str, decision: str, decided_by: str)`: チームで合意された仕様・設計要件を記録するツール。
  - `get_board_status()`: 現在の決定事項やバッジ獲得状況を確認するツール。

---

### 2. バックエンド & リアルタイム同期サーバー ([`mob-prompt-facilitator/frontend/`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend))

#### [NEW] [`frontend/server.py`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/server.py)
- FastAPI サーバーを構築し、以下のエンドポイントを提供：
  - `POST /api/join`: 参加者名・アバター登録
  - `GET /api/state`: 全メッセージ履歴、メンバー一覧（発言数・バッジ）、仕様決定一覧の取得
  - `GET /api/stream`: Server-Sent Events (SSE) によるリアルタイム更新通知（新規発言、バッジ進呈通知、エージェント思考・回答）
  - `POST /api/message`: ユーザーの発言送信 → ルームに配信し、ADK エージェントを起動してファシリテーションとツール呼び出しを実行
  - `GET /api/member/{name}/history`: 特定メンバーの発言履歴とバッジ獲得マーク付きイベントの取得
  - `GET /`: チャットUI（静的ファイル）の配信

---

### 3. リッチなモブプロンプティング WebUI ([`mob-prompt-facilitator/frontend/static/`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/static))

#### [NEW] [`static/index.html`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/static/index.html), [`static/style.css`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/static/style.css), [`static/app.js`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/static/app.js)
- **メインエリア（掲示板・グループチャット）**:
  - 全員の投稿がタイムライン形式で表示（送信者の名前・アバター・時刻付き）。
  - エージェントの発言（深掘り質問、論点整理、ツッコミ）は専用のハイライトカードとして表示。
  - バッジ進呈時はチャット内に華やかな「🎉 バッジ獲得アナウンスバナー」を表示。
  - 下部に発言フォーム（「[名前] として投稿」表示と、議論を活性化させるクイックプロンプト候補チップ）。
- **サイドバー（参加者・バッジ・ステータス）**:
  - **参加メンバー一覧**:
    - 各メンバーの名前、アバター、総発言件数、獲得バッジアイコンのバッジタグ。
    - **メンバークリック時の履歴モーダル/ドロワー**:
      - 該当メンバーの発言のみを時系列で閲覧可能。
      - バッジをもらった瞬間の発言には **「🏅 [バッジ名] 獲得！」** のハイライトバッジマークを表示。
  - **獲得可能バッジ一覧（バッジ図鑑）**:
    - どの発言をすればどんなバッジがもらえるかのガイド。
  - **合意事項・設計書リアルタイムプレビュー**:
    - エージェントが記録した仕様・要件がリアルタイムに更新されるアコーディオンパネル。

---

## 検証・テスト計画

### 1. 単体・エージェントテスト
- `mob-prompt-facilitator` 内で ADK エージェントのツール呼び出し（`award_badge`, `save_requirement_decision`）が正しく機能するかテスト。

### 2. 統合・マルチユーザーWebUI動作確認
1. ローカルサーバーを起動（ポート8080）。
2. ブラウザで複数のタブ（または別ウィンドウ）を開き、「メンバーA」「メンバーB」としてそれぞれ参加。
3. メンバーAが技術的な提案を発言 → メンバーBの画面にもリアルタイムに発言が反映されることを確認。
4. エージェントが介入し、メンバーAに「アーキテクト脳賞」を授与することを確認。
5. サイドバーのメンバーAの発言数がカウントアップし、獲得バッジに「アーキテクト脳賞」が追加されることを確認。
6. サイドバーでメンバーAをクリックし、発言履歴モーダルを開いて、該当発言にバッジ獲得マークが付いていることを確認。
