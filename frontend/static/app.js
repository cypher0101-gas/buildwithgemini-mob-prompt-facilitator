// Mob Prompt Facilitator - Frontend Client Logic

let currentUser = {
  name: localStorage.getItem("mob_user_name") || "",
  avatar: localStorage.getItem("mob_user_avatar") || "👨‍💻",
};

let currentMembers = {};
let availableBadges = {};
let currentActiveTopic = null;
let currentBacklog = [];
let eventSource = null;

// DOM Elements
const chatFeed = document.getElementById("chat-feed");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const memberList = document.getElementById("member-list");
const memberCount = document.getElementById("member-count");
const decisionsList = document.getElementById("decisions-list");
const decisionCount = document.getElementById("decision-count");
const badgeGuideList = document.getElementById("badge-guide-list");
const typingIndicator = document.getElementById("typing-indicator");
const connectionStatus = document.getElementById("connection-status");
const currentUserName = document.getElementById("current-user-name");
const currentUserAvatar = document.getElementById("current-user-avatar");
const senderDisplayName = document.getElementById("sender-display-name");
const userProfileTrigger = document.getElementById("user-profile-trigger");

// Shutter Bar & Drawer Elements
const activeTopicTitle = document.getElementById("active-topic-title");
const shutterToggleBtn = document.getElementById("shutter-toggle-btn");
const shutterArrow = document.getElementById("shutter-arrow");
const shutterPanel = document.getElementById("shutter-panel");
const shutterCloseBtn = document.getElementById("shutter-close-btn");
const shutterActiveTitle = document.getElementById("shutter-active-title");
const shutterActiveDesc = document.getElementById("shutter-active-desc");
const lockedCount = document.getElementById("locked-count");
const lockedDecisionsList = document.getElementById("locked-decisions-list");
const backlogItemsList = document.getElementById("backlog-items-list");

// Modal Elements
const historyModal = document.getElementById("history-modal");
const modalMemberName = document.getElementById("modal-member-name");
const modalMemberAvatar = document.getElementById("modal-member-avatar");
const modalMemberStats = document.getElementById("modal-member-stats");
const modalBadgesContainer = document.getElementById("modal-badges-container");
const historyTimeline = document.getElementById("history-timeline");
const modalCloseBtn = document.getElementById("modal-close-btn");

const joinModal = document.getElementById("join-modal");
const joinNameInput = document.getElementById("join-name-input");
const joinSubmitBtn = document.getElementById("join-submit-btn");
const avatarPicker = document.getElementById("avatar-picker");

// Initialize application
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramUser = urlParams.get("user") || urlParams.get("name");

  if (paramUser) {
    currentUser.name = paramUser;
    if (paramUser.includes("B") || paramUser.includes("b")) {
      currentUser.avatar = "👩‍💻";
    } else if (paramUser.includes("A") || paramUser.includes("a")) {
      currentUser.avatar = "👨‍💻";
    }
  } else if (!currentUser.name) {
    currentUser.name = "メンバー-" + Math.floor(100 + Math.random() * 900);
    localStorage.setItem("mob_user_name", currentUser.name);
    localStorage.setItem("mob_user_avatar", currentUser.avatar);
  }

  updateCurrentUserUI();
  await registerUserOnServer(currentUser.name, currentUser.avatar);
  await fetchInitialState();
  initSSE();
  setupEventListeners();
}

function updateCurrentUserUI() {
  currentUserName.textContent = currentUser.name;
  currentUserAvatar.textContent = currentUser.avatar;
  senderDisplayName.textContent = `${currentUser.avatar} ${currentUser.name}`;
}

async function registerUserOnServer(name, avatar) {
  try {
    await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar }),
    });
  } catch (err) {
    console.error("Failed to join room on server:", err);
  }
}

async function fetchInitialState() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    currentMembers = data.members || {};
    availableBadges = data.available_badges || {};
    currentActiveTopic = data.active_topic || null;
    currentBacklog = data.backlog || [];

    renderBadgeGuide(availableBadges);
    renderMembers(currentMembers);
    renderDecisions(data.decisions || []);
    renderActiveTopic(currentActiveTopic);
    renderBacklog(currentBacklog);

    chatFeed.innerHTML = "";
    (data.messages || []).forEach(msg => {
      appendMessageToChat(msg, false);
      if (msg.badge_awarded) {
        appendBadgeBanner(msg.badge_awarded, false);
      }
    });

    scrollToBottom();
  } catch (err) {
    console.error("Failed to fetch initial state:", err);
  }
}

// SSE Connection
function initSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource("/api/stream");

  eventSource.onopen = () => {
    connectionStatus.className = "status-pill online";
    connectionStatus.querySelector(".status-label").textContent = "接続中 (SSE)";
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerEvent(data);
    } catch (e) {
      // Keepalive / Ping
    }
  };

  eventSource.onerror = () => {
    connectionStatus.className = "status-pill";
    connectionStatus.querySelector(".status-label").textContent = "再接続待機中...";
  };
}

function handleServerEvent(event) {
  switch (event.type) {
    case "new_message":
      appendMessageToChat(event.message, true);
      if (event.members) {
        currentMembers = event.members;
        renderMembers(currentMembers);
      }
      break;

    case "badge_awarded":
      appendBadgeBanner(event.award, true);
      if (event.members) {
        currentMembers = event.members;
        renderMembers(currentMembers);
      }
      break;

    case "new_decision":
      appendDecision(event.decision);
      if (event.decisions) {
        renderDecisions(event.decisions);
      }
      break;

    case "active_topic_updated":
      currentActiveTopic = event.active_topic;
      renderActiveTopic(currentActiveTopic);
      break;

    case "backlog_updated":
      currentBacklog = event.backlog;
      renderBacklog(currentBacklog);
      break;

    case "agent_typing":
      typingIndicator.style.display = event.status ? "flex" : "none";
      if (event.status) scrollToBottom();
      break;

    case "member_joined":
      currentMembers[event.member.name] = event.member;
      renderMembers(currentMembers);
      break;
  }
}

// Render Active Topic & Shutter Drawer
function renderActiveTopic(topic) {
  if (!topic) return;
  activeTopicTitle.textContent = topic.title;
  shutterActiveTitle.textContent = topic.title;
  shutterActiveDesc.textContent = topic.description || "現在チームで議論中の中心的なテーマです";
}

function renderBacklog(backlog) {
  backlogItemsList.innerHTML = "";
  if (!backlog || backlog.length === 0) {
    backlogItemsList.innerHTML = '<div class="empty-state-sm">バックログ議題はありません</div>';
    return;
  }

  backlog.forEach(item => {
    const card = document.createElement("div");
    card.className = "backlog-item-card";
    card.innerHTML = `
      <strong>📌 ${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.description)}</p>
      <button class="promote-btn" onclick="promoteBacklogTopic('${item.id}')">🚀 議題を引き出して議論開始</button>
    `;
    backlogItemsList.appendChild(card);
  });
}

async function promoteBacklogTopic(itemId) {
  try {
    const res = await fetch("/api/topic/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });
    const data = await res.json();
    if (data.status === "ok") {
      renderActiveTopic(data.active_topic);
      renderBacklog(data.backlog);
    }
  } catch (err) {
    console.error("Failed to promote topic:", err);
  }
}

// Render Functions
function appendMessageToChat(msg, smoothScroll = true) {
  const isAgent = msg.role === "agent";
  const isSelf = msg.author === currentUser.name;
  const hasBadge = !!msg.badge_awarded;

  const row = document.createElement("div");
  row.className = `chat-row ${isAgent ? "agent-msg" : (isSelf ? "self-msg" : "user-msg")} ${hasBadge ? "has-badge" : ""}`;
  row.dataset.msgId = msg.id;

  let avatarSymbol = "👤";
  if (isAgent) {
    avatarSymbol = "🤖";
  } else if (currentMembers[msg.author]) {
    avatarSymbol = currentMembers[msg.author].avatar || "👤";
  }

  let bodyHtml = "";

  if (isAgent) {
    const rawText = msg.text || "";
    let feedbackPart = rawText;
    let grillPart = "";

    const splitKey = rawText.includes("【🔥 Grill Time") ? "【🔥 Grill Time" : (rawText.includes("### 🔥 Grill Time") ? "### 🔥 Grill Time" : (rawText.includes("【🔥 Grill") ? "【🔥 Grill" : null));

    if (splitKey) {
      const parts = rawText.split(splitKey);
      feedbackPart = parts[0].replace("【フィードバック＆レビュー】", "").trim();
      grillPart = (splitKey + parts.slice(1).join(splitKey)).trim();
    }

    bodyHtml = `
      <div class="agent-split-container">
        <div class="agent-feedback-card">
          <div class="card-content">${escapeHtml(feedbackPart).replace(/\n/g, '<br>')}</div>
        </div>
        ${grillPart ? `
          <div class="agent-grill-card">
            <div class="grill-card-header">
              <span class="grill-icon">🔥</span>
              <span>Grill Time (深掘り質問＆トレードオフ)</span>
            </div>
            <div class="card-content">${escapeHtml(grillPart).replace(/\n/g, '<br>')}</div>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    bodyHtml = `<div class="msg-bubble">${escapeHtml(msg.text)}</div>`;
  }

  row.innerHTML = `
    <div class="msg-avatar ${isAgent ? "agent-avatar" : ""}">
      ${avatarSymbol}
    </div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-author">
          ${escapeHtml(msg.author)}
          ${isAgent ? '<span class="agent-role-badge">Facilitator</span>' : ''}
        </span>
        <span class="msg-time">${msg.timestamp}</span>
      </div>
      ${bodyHtml}
      ${hasBadge ? `
        <div class="awarded-badge-sticker">
          ${msg.badge_awarded.badge.icon}「${escapeHtml(msg.badge_awarded.badge.name)}」獲得！
        </div>
      ` : ''}
    </div>
  `;

  chatFeed.appendChild(row);
  scrollToBottom(smoothScroll);
}

function appendBadgeBanner(award, smoothScroll = true) {
  const banner = document.createElement("div");
  banner.className = "badge-award-banner";
  banner.innerHTML = `
    <span class="badge-big-icon">${award.badge.icon}</span>
    <div class="badge-award-text">
      <h4>🎉 バッジ授与！【${escapeHtml(award.badge.name)}】</h4>
      <p>進呈理由: ${escapeHtml(award.reason)}</p>
    </div>
  `;
  chatFeed.appendChild(banner);
  scrollToBottom(smoothScroll);
}

function renderMembers(members) {
  const list = Object.values(members);
  memberCount.textContent = list.length;
  memberList.innerHTML = "";

  if (list.length === 0) {
    memberList.innerHTML = '<div class="empty-state">参加者を待っています...</div>';
    return;
  }

  // Sort by message count descending
  list.sort((a, b) => (b.message_count || 0) - (a.message_count || 0));

  list.forEach(m => {
    const card = document.createElement("div");
    card.className = "member-card";
    card.onclick = () => openMemberHistoryModal(m.name);

    const badgesHtml = (m.badges || []).map(b => `
      <span class="badge-tag" title="${escapeHtml(b.reason)}">
        ${b.badge.icon} ${escapeHtml(b.badge.name)}
      </span>
    `).join("");

    card.innerHTML = `
      <div class="member-card-top">
        <div class="member-card-left">
          <span class="member-avatar">${m.avatar || "👤"}</span>
          <span class="member-name-label">${escapeHtml(m.name)}</span>
        </div>
        <span class="msg-count-tag">${m.message_count || 0} 発言</span>
      </div>
      ${badgesHtml ? `<div class="member-badges-row">${badgesHtml}</div>` : ''}
    `;

    memberList.appendChild(card);
  });
}

function renderDecisions(decisions) {
  decisionCount.textContent = decisions.length;
  lockedCount.textContent = decisions.length;

  decisionsList.innerHTML = "";
  lockedDecisionsList.innerHTML = "";

  if (decisions.length === 0) {
    decisionsList.innerHTML = '<div class="empty-state">議論が進むと確定した仕様が自動記録されます</div>';
    lockedDecisionsList.innerHTML = '<div class="empty-state-sm">確定した仕様はここにロックされて保護されます</div>';
    return;
  }

  decisions.forEach(d => {
    appendDecision(d, false);
  });
}

function appendDecision(d, updateBadge = true) {
  if (decisionsList.querySelector(".empty-state")) {
    decisionsList.innerHTML = "";
  }
  if (lockedDecisionsList.querySelector(".empty-state-sm")) {
    lockedDecisionsList.innerHTML = "";
  }

  const card = document.createElement("div");
  card.className = "decision-card";
  card.innerHTML = `
    <div class="decision-topic">🔒 📌 ${escapeHtml(d.topic)}</div>
    <div class="decision-content">${escapeHtml(d.decision)}</div>
    <div class="decision-author">確定: ${escapeHtml(d.decided_by)} (${d.timestamp})</div>
  `;
  decisionsList.appendChild(card);

  const shutterLockedCard = document.createElement("div");
  shutterLockedCard.className = "backlog-item-card";
  shutterLockedCard.innerHTML = `
    <strong>🔒 📌 ${escapeHtml(d.topic)}</strong>
    <p>${escapeHtml(d.decision)}</p>
    <div style="font-size:0.68rem; color:var(--accent-emerald);">確定: ${escapeHtml(d.decided_by)}</div>
  `;
  lockedDecisionsList.appendChild(shutterLockedCard);

  if (updateBadge) {
    const currentNum = parseInt(decisionCount.textContent || 0) + 1;
    decisionCount.textContent = currentNum;
    lockedCount.textContent = currentNum;
  }
}

function renderBadgeGuide(badges) {
  badgeGuideList.innerHTML = "";
  Object.values(badges).forEach(b => {
    const item = document.createElement("div");
    item.className = "badge-guide-item";
    item.innerHTML = `
      <span class="badge-guide-icon">${b.icon}</span>
      <div class="badge-guide-info">
        <strong>${escapeHtml(b.name)}</strong>
        <p>${escapeHtml(b.description)}</p>
      </div>
    `;
    badgeGuideList.appendChild(item);
  });
}

// Modal: Member History
async function openMemberHistoryModal(name) {
  const member = currentMembers[name] || { name, avatar: "👤", message_count: 0, badges: [] };
  modalMemberName.textContent = member.name;
  modalMemberAvatar.textContent = member.avatar || "👤";
  modalMemberStats.textContent = `総発言数: ${member.message_count || 0} 件 | 獲得バッジ: ${(member.badges || []).length} 個`;

  modalBadgesContainer.innerHTML = (member.badges || []).length > 0
    ? (member.badges || []).map(b => `
        <span class="badge-tag" style="font-size:0.8rem; padding:0.3rem 0.6rem;">
          ${b.badge.icon} ${escapeHtml(b.badge.name)}: ${escapeHtml(b.reason)}
        </span>
      `).join("")
    : '<span style="font-size:0.8rem; color:var(--text-muted);">まだ獲得したバッジはありません</span>';

  historyTimeline.innerHTML = '<div class="empty-state">履歴を読み込み中...</div>';
  historyModal.style.display = "flex";

  try {
    const res = await fetch(`/api/member/${encodeURIComponent(name)}/history`);
    const history = await res.json();

    historyTimeline.innerHTML = "";
    if (history.length === 0) {
      historyTimeline.innerHTML = '<div class="empty-state">発言履歴がまだありません</div>';
      return;
    }

    history.forEach(item => {
      const isBadge = !!item.badge_awarded;
      const el = document.createElement("div");
      el.className = `timeline-item ${isBadge ? "badge-received" : ""}`;
      el.innerHTML = `
        <div class="timeline-header">
          <span class="timeline-time">${item.timestamp}</span>
          ${isBadge ? `
            <span class="timeline-badge-tag">
              ${item.badge_awarded.badge.icon}「${escapeHtml(item.badge_awarded.badge.name)}」獲得！
            </span>
          ` : ''}
        </div>
        <div class="timeline-text">${escapeHtml(item.text)}</div>
        ${isBadge ? `
          <div class="timeline-reason">
            🎉 称賛理由: ${escapeHtml(item.badge_awarded.reason)}
          </div>
        ` : ''}
      `;
      historyTimeline.appendChild(el);
    });
  } catch (err) {
    historyTimeline.innerHTML = '<div class="empty-state">履歴の取得に失敗しました</div>';
  }
}

function scrollToBottom(smooth = true) {
  chatFeed.scrollTo({
    top: chatFeed.scrollHeight,
    behavior: smooth ? "smooth" : "auto",
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Event Listeners
function setupEventListeners() {
  // Shutter Panel Toggle
  shutterToggleBtn.addEventListener("click", () => {
    const isOpen = shutterPanel.style.display === "flex";
    shutterPanel.style.display = isOpen ? "none" : "flex";
    shutterArrow.classList.toggle("open", !isOpen);
  });

  shutterCloseBtn.addEventListener("click", () => {
    shutterPanel.style.display = "none";
    shutterArrow.classList.remove("open");
  });

  // Shutter Resize Handle Drag & Drop
  const shutterResizeHandle = document.getElementById("shutter-resize-handle");
  if (shutterResizeHandle) {
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      startHeight = shutterPanel.offsetHeight;
      shutterResizeHandle.classList.add("dragging");
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("touchmove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchend", onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const currentY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const deltaY = currentY - startY;
      const newHeight = Math.max(140, Math.min(window.innerHeight - 180, startHeight + deltaY));
      shutterPanel.style.height = `${newHeight}px`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      shutterResizeHandle.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchend", onMouseUp);
    };

    shutterResizeHandle.addEventListener("mousedown", onMouseDown);
    shutterResizeHandle.addEventListener("touchstart", onMouseDown);
  }

  // Chat message submit
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = "";
    messageInput.style.height = "auto";

    try {
      await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: currentUser.name,
          text: text,
        }),
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  });

  // Enter to send (Shift+Enter for newline)
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event("submit"));
    }
  });

  // Suggestion chips
  document.querySelectorAll(".suggestion-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      messageInput.value = chip.dataset.text;
      messageInput.focus();
    });
  });

  // Profile / Join Modal triggers
  userProfileTrigger.addEventListener("click", () => {
    joinNameInput.value = currentUser.name;
    joinModal.style.display = "flex";
  });

  modalCloseBtn.addEventListener("click", () => {
    historyModal.style.display = "none";
  });

  historyModal.addEventListener("click", (e) => {
    if (e.target === historyModal) {
      historyModal.style.display = "none";
    }
  });

  // Avatar picker
  avatarPicker.querySelectorAll(".avatar-option").forEach(btn => {
    btn.addEventListener("click", () => {
      avatarPicker.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      currentUser.avatar = btn.dataset.avatar;
    });
  });

  joinSubmitBtn.addEventListener("click", async () => {
    const newName = joinNameInput.value.trim();
    if (!newName) return;
    currentUser.name = newName;
    localStorage.setItem("mob_user_name", currentUser.name);
    localStorage.setItem("mob_user_avatar", currentUser.avatar);

    updateCurrentUserUI();
    await registerUserOnServer(currentUser.name, currentUser.avatar);
    joinModal.style.display = "none";
  });
}

// Start app
document.addEventListener("DOMContentLoaded", init);
