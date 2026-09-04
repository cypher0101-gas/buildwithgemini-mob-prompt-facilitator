# モブプロンプト・ファシリテーター（WebUI ＆ エージェント）完成ウォークスルー

複数人の参加者が同一のURLに接続し、グループチャット（掲示板形式）でアイデア出しや要件定義の議論を行いながら、AIエージェント（`MobPromptFacilitator`）が議論をファシリテーションし、メンバーの貢献に対してリアルタイムにバッジを進呈するWebアプリケーションを実装・検証しました。

---

## 1. 実装した主要コンポーネント

| ファイル | 役割・概要 |
|---|---|
| [`app/state.py`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/app/state.py) | 全参加者共通のメッセージ、メンバー（発言数・獲得バッジ）、仕様決定事項を管理するステートマネージャー。SSE配信機能付き。 |
| [`app/agent.py`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/app/agent.py) | ADKエージェント。議論を観察し、的確なツッコミ（Grill）・論点整理を行いながら、`award_badge` や `save_requirement_decision` ツールを実行。 |
| [`frontend/server.py`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/server.py) | FastAPI + SSEバックエンド。マルチユーザーの参加受付、メッセージ同期、エージェント実行、静的ファイル配信を提供。 |
| [`frontend/static/index.html`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/static/index.html) | グループチャット画面、サイドバー（メンバー一覧・確定仕様・バッジ図鑑）、発言履歴モーダル。 |
| [`frontend/static/style.css`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/static/style.css) | 洗練されたダークモード、グラスモフィズム、金色に光るバッジ、アニメーション等を適用したデザイン。 |
| [`frontend/static/app.js`](file:///config/Desktop/BuildWithGemini/mob-prompt-facilitator/frontend/static/app.js) | SSEストリームのリアルタイム受信・描画、メンバー別発言履歴モーダル（バッジ獲得マーク付き）の制御。 |

---

## 2. 動作検証結果

### ① 自動テスト（単体テスト＆統合テスト）
```bash
uv run python -m pytest tests/unit/
# 結果: 2 passed in 2.50s (BoardStoreのメンバー・メッセージ・バッジ付与テスト合格)

GOOGLE_GENAI_USE_VERTEXAI=true GOOGLE_CLOUD_PROJECT=... uv run python -m pytest tests/integration/test_agent.py
# 結果: 1 passed in 10.69s (ADKエージェントのストリーミング応答合格)
```

### ② マルチユーザー対話＆バッジ付与の検証
1. **メンバーAが参加して技術提案を発言**:
   - 発言: *「負荷の変動が激しく運用工数を最小化したいので、バックエンドは Cloud Run と Firestore のサーバーレス構成が良いと思います！」*
   - エージェントの対応:
     - 🏗️ **「アーキテクト脳賞」** をメンバーAに即座に授与（理由: 負荷変動への追従と運用工数最小化を見据えたフルサーバーレス構成の提案）。
     - 確定仕様として `[バックエンド基本構成]` を記録。
     - 次の論点として「Firestore Native vs Datastore」「スパイク時のコスト・コールドスタート対策」を投げかけ。

2. **メンバーBが参加して鋭いツッコミを発言**:
   - 発言: *「Firestore Nativeだと1秒間に同じドキュメントへの書き込みが1回というソフトリミットがあるよね。同時編集したらエラー頻発するリスクがあるのでは？」*
   - エージェントの対応:
     - 🎯 **「鋭いツッコミ賞」** をメンバーBに即座に授与（理由: 1秒間に1更新の制約と共同編集時のホットスポット化リスクを指摘）。
     - 解決策のトレードオフ（ドキュメント分割、デバウンス、Redis併用）を整理してチームに提案。

3. **サイドバーおよび履歴表示の検証**:
   - サイドバーに各メンバーのアバター、名前、発言数、獲得バッジアイコンがリアルタイム表示。
   - メンバーをクリックすると **発言履歴モーダル** が開き、バッジを獲得した発言に **「🏅 [バッジ名] 獲得！」** の目印と称賛理由が表示されることを確認。

---

## 3. WebUI へのアクセス方法

サーバーはポート `8080` で稼働しています：

- **URL**: [http://127.0.0.1:8080/](http://127.0.0.1:8080/)
- ブラウザで複数のタブを開いてそれぞれ別の参加者名を入力することで、リアルタイムなモブプロンプティング体験をお試しいただけます。
