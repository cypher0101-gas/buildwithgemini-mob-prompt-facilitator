# Copyright 2026 Google LLC
# Unit tests for BoardStore

from app.state import BoardStore, AVAILABLE_BADGES

def test_board_store_flow():
    store = BoardStore()
    
    # 1. Register members
    m1 = store.register_member("Alice", "👩‍💻")
    m2 = store.register_member("Bob", "👨‍💻")
    assert m1["name"] == "Alice"
    assert m1["message_count"] == 0
    assert len(store.members) == 2

    # 2. Add messages
    msg1 = store.add_message("Alice", "Cloud RunとFirestoreを使いたい！", role="user")
    assert store.members["Alice"]["message_count"] == 1
    assert msg1["badge_awarded"] is None

    # 3. Award badge
    award = store.award_badge("Alice", "アーキテクト脳賞", "GCPサーバーレス構成の的確な提案")
    assert award["badge"]["id"] == "architect_mind"
    assert len(store.members["Alice"]["badges"]) == 1
    
    # Check that msg1 now has badge_awarded marked
    assert msg1["badge_awarded"] is not None
    assert msg1["badge_awarded"]["badge"]["name"] == "アーキテクト脳賞"

    # 4. Member history
    history = store.get_member_history("Alice")
    assert len(history) == 1
    assert history[0]["badge_awarded"] is not None

    # 5. Add decision
    dec = store.add_decision("データベース選定", "Firestoreを採用する", "Alice")
    assert dec["topic"] == "データベース選定"
    assert len(store.decisions) == 1
