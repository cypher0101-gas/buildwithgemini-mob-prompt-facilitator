# 個人のローカル/AGY環境 引き継ぎ＆初期セットアップガイド 🛠️

このガイドは、ワークショップ環境からご自身のローカルPCや Antigravity (AGY) 環境へコードを引き継ぎ、開発を継続するための完全セットアップマニュアルです。

---

## 🎁 Build with Gemini ワークショップ情報＆特典URL

- **公式プロジェクト提出・ノベルティ申請フォーム**:
  [Build with Gemini Project Submission Form](https://docs.google.com/forms/d/e/1FAIpQLSfvbIUMrHLf2iUYVgQkr981unQwuLdigLB7yJp3VdtYH85Dzw/viewform)
- **リポジトリURL事前入力済み 提出フォーム**:
  [リポジトリ設定済み申請フォーム](https://docs.google.com/forms/d/e/1FAIpQLSfvbIUMrHLf2iUYVgQkr981unQwuLdigLB7yJp3VdtYH85Dzw/viewform?usp=pp_url&entry.896374137=https%3A%2F%2Fgithub.com%2Fcypher0101-gas%2Fbuildwithgemini-mob-prompt-facilitator)
- **対象特典**:
  - 提出者全員: Build with Gemini オリジナルノベルティ (クルーネック等) ＆ Google Developer Profile (GDP) バッジ
  - 優秀作品: Build with Gemini Track 3 公式 GitHub ギャラリーへの掲載

---

## 1. 開発環境の前提条件 (Prerequisites)

ローカル環境に必要な基本ツールのセットアップ：

1. **Python 3.11〜3.13**
2. **uv (Python高速パッケージマネージャー)**:
   ```bash
   # macOS / Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```
3. **Google Cloud SDK (gcloud CLI)**:
   - [Google Cloud SDK インストールガイド](https://cloud.google.com/sdk/docs/install)
4. **GitHub CLI (gh CLI)**:
   - [GitHub CLI インストールガイド](https://cli.github.com/)

---

## 2. ADK (Agent Development Kit) & `agents-cli` のセットアップ

ADK エージェント開発CLIツール (`google-agents-cli`) をセットアップします。

```bash
# agents-cli のグローバルインストール
uv tool install google-agents-cli

# 初期セットアップ（Skillsの展開など）
uvx google-agents-cli setup
```

---

## 3. MCP (Model Context Protocol) サーバーのセットアップ

本プロジェクトのワークショップ環境では、以下の2つの MCP サーバーが構成されていました。

### ① `firebase` MCP サーバー
- **用途**: Firebase デプロイ・プロジェクト管理・セキュリティルール読み書き
- **設定手順**:
  1. Node.js (npx) が利用可能な状態で Firebase MCP ツールを有効化
  2. `firebase-tools` のログイン: `npx firebase-tools login`

### ② `google-developer-knowledge` MCP サーバー
- **用途**: Google 公式開発ドキュメント（ADK, Vertex AI, Gemini API）の検索・ナレッジ回答
- **設定手順**:
  Antigravity / IDE の MCP 設定ファイル (`~/.gemini/antigravity/mcp_config.json` 等) に追加します。

---

## 4. プロジェクトの取得＆依存関係のインストール

ご自身の環境でリポジトリをクローンし、依存パッケージを導入します。

```bash
# 1. リポジトリのクローン
git clone https://github.com/cypher0101-gas/buildwithgemini-mob-prompt-facilitator.git
cd buildwithgemini-mob-prompt-facilitator

# 2. 依存関係の同期（仮想環境 .venv の自動構築）
uv sync

# 3. agents-cli のインストール確認
agents-cli install
```

---

## 5. Google Cloud 認証＆環境変数の設定

Gemini 2.5 API および Vertex AI を利用するための認証と環境変数を設定します。

### 認証コマンド
```bash
# gcloud のログイン
gcloud auth login

# アプリケーションデフォルト認証 (ADC) の設定
gcloud auth application-default login

# デフォルトプロジェクトの設定
gcloud config set project YOUR_GOOGLE_CLOUD_PROJECT_ID
```

### 環境変数 (`.env` ファイルの作成)
プロジェクトルートに `.env` ファイルを作成するか、シェルでエクスポートします：

```env
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=YOUR_GOOGLE_CLOUD_PROJECT_ID
GOOGLE_CLOUD_LOCATION=us-east1
```

---

## 6. ローカルでの動作確認 & デプロイ

### 🟢 ローカル WebUI（マルチユーザー対応）の起動
```bash
GOOGLE_GENAI_USE_VERTEXAI=true GOOGLE_CLOUD_PROJECT=YOUR_GOOGLE_CLOUD_PROJECT_ID uv run python frontend/server.py
```
ブラウザで以下のURLを開きます：
- ジェミ助さん: `http://127.0.0.1:8080/?user=ジェミ助`
- ミニーさん: `http://127.0.0.1:8080/?user=ミニー`

### ☁️ ご自身の GCP アカウントへの Agent Runtime デプロイ
```bash
agents-cli deploy --no-confirm-project --project YOUR_GOOGLE_CLOUD_PROJECT_ID
```

---

## 📚 参考ドキュメントリンク
- [ADK (Agent Development Kit) 公式ドキュメント](https://adk.dev/)
- [A2A Protocol 仕様・Inspector](https://a2a-protocol.org/)
- [Google Cloud Vertex AI Agent Engine](https://cloud.google.com/vertex-ai/docs)
