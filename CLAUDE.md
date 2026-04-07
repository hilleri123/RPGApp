# Project: НРИ Backend (FastAPI)
Stack: Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis, WebSocket

## Structure
- Entities: story_beat, location, npc, item, character, note, counter
- scene_exposure on: story_beat, location
- Roles: user, master, admin
- WebSocket: game session management

## Dev setup
docker compose -f compose.yml -f compose.dev.yml up

## Rules
- Always create feature branch before changes
- Run tests before committing
