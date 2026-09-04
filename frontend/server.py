# Copyright 2026 Google LLC
# FastAPI Server for Multi-User Mob Prompting Group Chat Board

import asyncio
import os
import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agent import root_agent
from app.state import board_store, AVAILABLE_BADGES

# Shared session setup
session_service = InMemorySessionService()
runner = Runner(agent=root_agent, session_service=session_service, app_name="mob_app")
SHARED_SESSION_ID: str | None = None
_agent_lock = asyncio.Lock()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global SHARED_SESSION_ID
    session = await session_service.create_session(user_id="group_mob", app_name="mob_app")
    SHARED_SESSION_ID = session.id
    yield

app = FastAPI(title="Mob Prompt Facilitator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class JoinRequest(BaseModel):
    name: str
    avatar: str = "👤"

class MessageRequest(BaseModel):
    author: str
    text: str

@app.get("/api/state")
async def get_state():
    return JSONResponse(board_store.get_state())

@app.post("/api/join")
async def join_room(req: JoinRequest):
    member = board_store.register_member(req.name, req.avatar)
    return JSONResponse(member)

@app.get("/api/member/{name}/history")
async def get_member_history(name: str):
    history = board_store.get_member_history(name)
    return JSONResponse(history)

async def _process_agent_turn(author: str, text: str):
    async with _agent_lock:
        board_store._broadcast({"type": "agent_typing", "status": True})
        try:
            content = types.Content(
                role="user",
                parts=[types.Part.from_text(text=f"[{author}]: {text}")],
            )
            response_texts = []
            async for event in runner.run_async(
                new_message=content,
                user_id="group_mob",
                session_id=SHARED_SESSION_ID,
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            response_texts.append(part.text)

            full_reply = "".join(response_texts).strip()
            if full_reply:
                board_store.add_message(
                    author="MobPromptFacilitator",
                    text=full_reply,
                    role="agent",
                )
        except Exception as e:
            board_store.add_message(
                author="MobPromptFacilitator",
                text=f"⚠️ エージェント処理中にエラーが発生しました: {str(e)}",
                role="agent",
            )
        finally:
            board_store._broadcast({"type": "agent_typing", "status": False})

class PromoteRequest(BaseModel):
    item_id: str

@app.post("/api/topic/promote")
async def promote_topic(req: PromoteRequest):
    promoted = board_store.promote_backlog(req.item_id)
    if promoted:
        return JSONResponse({"status": "ok", "active_topic": board_store.active_topic, "backlog": board_store.backlog})
    return JSONResponse({"status": "error", "message": "Item not found"}, status_code=404)

@app.post("/api/message")
async def post_message(req: MessageRequest):
    if not req.text.strip():
        return JSONResponse({"status": "error", "message": "Text cannot be empty"}, status_code=400)

    # 1. Add user message immediately
    user_msg = board_store.add_message(
        author=req.author,
        text=req.text,
        role="user",
    )

    # 2. Trigger agent in background
    asyncio.create_task(_process_agent_turn(req.author, req.text))

    return JSONResponse({"status": "ok", "message": user_msg})

@app.get("/api/stream")
async def stream_events(request: Request):
    q = board_store.register_listener()

    async def event_generator():
        try:
            # Send initial ping
            yield {"event": "ping", "data": "connected"}
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event_data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {"event": "message", "data": json.dumps(event_data, ensure_ascii=False)}
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "keepalive"}
        finally:
            board_store.unregister_listener(q)

    return EventSourceResponse(event_generator())

# Mount static files for the Web UI
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
