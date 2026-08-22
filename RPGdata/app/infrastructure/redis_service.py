"""ПРОШЛОЕ ГОВНО2"""
import asyncio
import json
import os
import redis
from typing import Dict, List, Callable, Any
import redis.asyncio as redis
from app.managers import connection_manager

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Глобальные переменные
producer = None
consumer = None

# Инициализация Redis клиента
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

async def redis_listener():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("schema_updates")
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            await connection_manager.send_json(data["client_id"], data["schema"])
