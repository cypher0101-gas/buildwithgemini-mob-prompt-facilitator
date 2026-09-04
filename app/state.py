# Copyright 2026 Google LLC
# Shared in-memory state store for MobPromptFacilitator

import asyncio
import datetime
import uuid
from typing import Any, Callable

AVAILABLE_BADGES = {
    "鋭いツッコミ賞": {
        "id": "sharp_critic",
        "name": "鋭いツッコミ賞",
        "icon": "🎯",
        "description": "設計の穴や潜在的リスク・エッジケースを的確に指摘した",
    },
    "ナイスアイデア賞": {
        "id": "idea_spark",
        "name": "ナイスアイデア賞",
        "icon": "💡",
        "description": "独創的で面白いアプローチや魅力的な新機能を提案した",
    },
    "アーキテクト脳賞": {
        "id": "architect_mind",
        "name": "アーキテクト脳賞",
        "icon": "🏗️",
        "description": "技術選定・スケーラビリティ・トレードオフを意識した構造的提案をした",
    },
    "合意形成マスター": {
        "id": "consensus_maker",
        "name": "合意形成マスター",
        "icon": "🤝",
        "description": "意見の対立を整理し、チームの合意形成を前に進めた",
    },
    "プロンプト職人": {
        "id": "prompt_crafter",
        "name": "プロンプト職人",
        "icon": "🪄",
        "description": "文脈や条件が整理され、LLMの能力を最大限引き出すプロンプトを投げた",
    },
}

class BoardStore:
    def __init__(self):
        self.messages: list[dict[str, Any]] = []
        self.members: dict[str, dict[str, Any]] = {}
        self.decisions: list[dict[str, Any]] = []
        self.backlog: list[dict[str, Any]] = [
            {
                "id": "b1",
                "title": "Firestore Nativeの1秒1回書き込み制限への対策",
                "description": "リアルタイム同時編集時のホットスポット化リスク回避策（ドキュメント分割・デバウンス・Redis併用など）",
                "status": "backlog",
            },
            {
                "id": "b2",
                "title": "認証とユーザー権限管理",
                "description": "Firebase Auth または OAuth2 による認証と閲覧・編集権限の制御",
                "status": "backlog",
            },
            {
                "id": "b3",
                "title": "Cloud Run コールドスタート＆コスト最適化",
                "description": "最小インスタンス数設定やスパイク時のオートスケール上限の設計",
                "status": "backlog",
            },
        ]
        self.active_topic: dict[str, Any] = {
            "id": "active_default",
            "title": "システム全体アーキテクチャと基本要件の選定",
            "description": "モブプロンプト・アリーナの基本システム構成と主要技術スタックの選定",
            "updated_at": datetime.datetime.now().strftime("%H:%M:%S"),
        }
        self._listeners: list[asyncio.Queue] = []
        self._last_user_message_id: str | None = None

        # Add initial welcome message from the agent
        welcome_id = str(uuid.uuid4())
        self.messages.append({
            "id": welcome_id,
            "author": "MobPromptFacilitator",
            "role": "agent",
            "text": "ようこそ！モブプロンプト・アリーナ (Mob Prompt Arena) へ 🚀\nチームで何を作りたいか、どんなアイデア・技術を使いたいか、自由に発言してください！\n優れたアイデアや鋭いツッコミ、アーキテクチャ提案にはバッジを授与します 🏅",
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "badge_awarded": None,
        })

    def register_listener(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self._listeners.append(q)
        return q

    def unregister_listener(self, q: asyncio.Queue) -> None:
        if q in self._listeners:
            self._listeners.remove(q)

    def _broadcast(self, event: dict[str, Any]) -> None:
        for q in list(self._listeners):
            try:
                q.put_nowait(event)
            except Exception:
                pass

    def register_member(self, name: str, avatar: str = "👤") -> dict[str, Any]:
        clean_name = name.strip()
        if not clean_name:
            clean_name = "Anonymous"
        if clean_name not in self.members:
            self.members[clean_name] = {
                "name": clean_name,
                "avatar": avatar,
                "message_count": 0,
                "badges": [],
                "joined_at": datetime.datetime.now().strftime("%H:%M:%S"),
            }
            self._broadcast({"type": "member_joined", "member": self.members[clean_name]})
        return self.members[clean_name]

    def add_message(
        self,
        author: str,
        text: str,
        role: str = "user",
        badge_awarded: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        msg_id = str(uuid.uuid4())
        clean_author = author.strip()
        now_str = datetime.datetime.now().strftime("%H:%M:%S")

        if role == "user":
            self._last_user_message_id = msg_id
            if clean_author not in self.members:
                self.register_member(clean_author)
            self.members[clean_author]["message_count"] += 1

        msg = {
            "id": msg_id,
            "author": clean_author,
            "role": role,
            "text": text,
            "timestamp": now_str,
            "badge_awarded": badge_awarded,
        }
        self.messages.append(msg)
        self._broadcast({"type": "new_message", "message": msg, "members": self.members})
        return msg

    def award_badge(self, member_name: str, badge_name: str, reason: str) -> dict[str, Any]:
        clean_name = member_name.strip()
        if clean_name not in self.members:
            self.register_member(clean_name)

        badge_info = AVAILABLE_BADGES.get(badge_name)
        if not badge_info:
            for b in AVAILABLE_BADGES.values():
                if b["name"] in badge_name or b["id"] in badge_name:
                    badge_info = b
                    break
        if not badge_info:
            badge_info = {
                "id": "special_badge",
                "name": badge_name,
                "icon": "🏅",
                "description": reason,
            }

        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        award_record = {
            "id": str(uuid.uuid4()),
            "badge": badge_info,
            "reason": reason,
            "timestamp": now_str,
            "message_id": self._last_user_message_id,
        }

        # Mark the last user message if it belongs to this member
        if self._last_user_message_id:
            for m in reversed(self.messages):
                if m["id"] == self._last_user_message_id and m["author"] == clean_name:
                    m["badge_awarded"] = award_record
                    break

        self.members[clean_name]["badges"].append(award_record)
        self._broadcast({
            "type": "badge_awarded",
            "member_name": clean_name,
            "award": award_record,
            "members": self.members,
        })
        return award_record

    def set_active_topic(self, title: str, description: str = "") -> dict[str, Any]:
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        self.active_topic = {
            "id": str(uuid.uuid4()),
            "title": title,
            "description": description,
            "updated_at": now_str,
        }
        self._broadcast({"type": "active_topic_updated", "active_topic": self.active_topic})
        return self.active_topic

    def add_to_backlog(self, title: str, description: str = "") -> dict[str, Any]:
        item = {
            "id": str(uuid.uuid4()),
            "title": title,
            "description": description,
            "status": "backlog",
        }
        self.backlog.append(item)
        self._broadcast({"type": "backlog_updated", "backlog": self.backlog})
        return item

    def promote_backlog(self, item_id: str) -> dict[str, Any] | None:
        target = None
        for item in self.backlog:
            if item["id"] == item_id:
                target = item
                break
        if target:
            self.backlog.remove(target)
            self.set_active_topic(title=target["title"], description=target["description"])
            self._broadcast({"type": "backlog_updated", "backlog": self.backlog})
            return target
        return None

    def add_decision(self, topic: str, decision: str, decided_by: str) -> dict[str, Any]:
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        dec = {
            "id": str(uuid.uuid4()),
            "topic": topic,
            "decision": decision,
            "decided_by": decided_by,
            "timestamp": now_str,
            "locked": True,
        }
        self.decisions.append(dec)
        self._broadcast({"type": "new_decision", "decision": dec, "decisions": self.decisions})
        return dec

    def get_state(self) -> dict[str, Any]:
        return {
            "messages": self.messages,
            "members": self.members,
            "decisions": self.decisions,
            "active_topic": self.active_topic,
            "backlog": self.backlog,
            "available_badges": AVAILABLE_BADGES,
        }

    def get_member_history(self, member_name: str) -> list[dict[str, Any]]:
        clean_name = member_name.strip()
        history = [m for m in self.messages if m["author"] == clean_name and m["role"] == "user"]
        return history

# Global singleton store instance
board_store = BoardStore()
