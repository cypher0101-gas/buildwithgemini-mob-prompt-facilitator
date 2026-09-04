# ruff: noqa
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.models import Gemini
from google.genai import types

from app.state import board_store, AVAILABLE_BADGES

MODEL = "gemini-3.6-flash"


def award_badge(member_name: str, badge_name: str, reason: str) -> str:
    """参加メンバーの発言に対してバッジを進呈します。

    Args:
        member_name: バッジを授与するメンバーの名前。
        badge_name: 授与するバッジの名前（例：「鋭いツッコミ賞」「ナイスアイデア賞」「アーキテクト脳賞」「合意形成マスター」「プロンプト職人」）。
        reason: このバッジを授与した具体的な理由や称賛コメント。

    Returns:
        バッジ授与の完了メッセージ。
    """
    record = board_store.award_badge(member_name=member_name, badge_name=badge_name, reason=reason)
    return f"【バッジ授与完了】{member_name} さんに {record['badge']['icon']}「{record['badge']['name']}」を進呈しました！理由: {reason}"


def save_requirement_decision(topic: str, decision: str, decided_by: str) -> str:
    """チーム内で合意または確定した仕様・設計方針・技術要件を記録します。

    Args:
        topic: 決定事項のトピックや項目名（例：「データベース選定」「認証方式」「デプロイ環境」など）。
        decision: 具体的な決定内容や理由。
        decided_by: 提案または主導したメンバー名や「チーム合意」。

    Returns:
        決定事項記録の完了メッセージ。
    """
    rec = board_store.add_decision(topic=topic, decision=decision, decided_by=decided_by)
    return f"【仕様確定】トピック: {topic} / 内容: {decision}（決定: {decided_by}）を仕様書に記録しました。"


def get_board_status() -> str:
    """現在の掲示板の状態（参加メンバー、獲得バッジ、確定した仕様一覧）を取得します。

    Returns:
        現在の掲示板状況のサマリーテキスト。
    """
    state = board_store.get_state()
    members_summary = []
    for name, data in state["members"].items():
        badges_str = ", ".join([b["badge"]["name"] for b in data["badges"]]) or "なし"
        members_summary.append(f"- {name}: 発言数 {data['message_count']}件, 獲得バッジ [{badges_str}]")

    decisions_summary = []
    for d in state["decisions"]:
        decisions_summary.append(f"- [{d['topic']}]: {d['decision']} (by {d['decided_by']})")

    return (
        f"【現在のメンバー状況】\n" + ("\n".join(members_summary) or "参加者なし") + "\n\n"
        f"【確定した仕様一覧】\n" + ("\n".join(decisions_summary) or "確定仕様はまだありません")
    )


def set_active_topic(title: str, description: str) -> str:
    """議論中の中心的なテーマ・議題（Active Topic）を切り替えます。

    Args:
        title: 議題のタイトル（1〜2行で簡潔に）。
        description: 議題の背景や議論したいトレードオフの概要。

    Returns:
        議題変更の完了メッセージ。
    """
    topic = board_store.set_active_topic(title=title, description=description)
    return f"【議題更新】新しい議論テーマ「{title}」に設定しました。"


INSTRUCTION = """あなたは複数人による「モブプロンプティング（Mob Prompting）」のファシリテーター兼レビュアー（MobPromptFacilitator / Team Grill-Master）です。

【あなたのミッション】
1. 参加者全員が1つのグループチャット・アリーナで対話・議論しています。
2. メンバーの発言を観察し、的確なツッコミ（Grill）、論点整理、トレードオフの提示を行い、議論を前に進めてください。
3. メンバーが光る発言をした時は、積極的に `award_badge` ツールを使ってバッジを進呈してください！
   - 🎯「鋭いツッコミ賞」: 潜在的リスク、設計の穴、運用課題、コストなどを鋭く指摘した発言
   - 💡「ナイスアイデア賞」: 斬新な発想、ユニークなUX、魅力的な企画アイデア
   - 🏗️「アーキテクト脳賞」: GCP等の技術選定、スケーラビリティ、可用性、整合性等の技術的・構造的提案
   - 🤝「合意形成マスター」: 割れた意見の落とし所を見つけたり、チームを合意へ導いた発言
   - 🪄「プロンプト職人」: 背景・制約・出力形式が整理され、AIを巧みに誘導する優れたプロンプト
4. 新しい論点や議題に移行した場合は、`set_active_topic` ツールを使って議論中テーマ（Active Topic）を更新してください。
5. チームでアーキテクチャや機能要件が確定・合意されたら、`save_requirement_decision` ツールで仕様書に記録（ロック 🔒）してください。

【重要：回答のフォーマット】
あなたの回答は、必ず以下の2つの見出し（【フィードバック＆レビュー】 と 【🔥 Grill Time】）を明確に分けて出力してください！UI上で2つの異なる吹き出し（フィードバック用 💬 と Grill Time用 🔥）に自動分離して表示されます。

【フィードバック＆レビュー】
(メンバーの発言に対するコメント、称賛、バッジ授与の理由説明)

【🔥 Grill Time】
(現在進行形の議題に対するツッコミ、投げかけ、比較検討すべきトレードオフの質問)
"""

root_agent = Agent(
    name="root_agent",
    model=Gemini(
        model=MODEL,
        retry_options=types.HttpRetryOptions(attempts=3),
    ),
    instruction=INSTRUCTION,
    tools=[award_badge, save_requirement_decision, get_board_status, set_active_topic],
)

app = App(
    root_agent=root_agent,
    name="app",
)
