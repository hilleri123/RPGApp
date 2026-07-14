# Project: НРИ Backend (FastAPI)
Stack: Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis, RabbitMQ, WebSocket

## Structure
- Entities: story_beat, location, npc, item, character, note, counter
- scene_exposure on: story_beat, location
- Roles: user, master, admin
- WebSocket: game session management
- Telegram bot: `telegram-bot/` (separate container, RabbitMQ RPC to API)

## Dev setup
docker compose -f compose.dev.yml up

## Rules
- Always create feature branch before changes
- Run tests before committing
