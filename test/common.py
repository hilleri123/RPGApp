import asyncio
import threading
import httpx
import websockets
import json
import random
import uuid
from config import *


def get_access_token(user_data):
    """Синхронно получает access token с использованием формы"""
    with httpx.Client() as client:
        # Отправляем данные как form-data (x-www-form-urlencoded)
        response = client.post(
            f"{SERVER_URL}{LOGIN_ENDPOINT}",
            data=user_data  # Используем data вместо json
        )
        response.raise_for_status()
        return response.json()["access_token"]
    


async def receive_messages(websocket: websockets.WebSocketClientProtocol, username: str):
    async for message in websocket:
        print(f"{username} получил состояние: {message}")


def client_thread(user: str, websocket_func):
    username = user["username"]
    token = get_access_token(user)
    print(f"{username} token: {token[:15]}...")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    loop.run_until_complete(websocket_func(token, username))
    loop.close()



async def find_lobby_id(token):
    headers = {"authorization": f"Bearer {token}"}
    lobby_id = None
    while not lobby_id:
        with httpx.Client() as client:
            response = client.get(
                f"{SERVER_URL}{LOBBY_ENDPOINT}",
                headers=headers
            )
            response.raise_for_status()
        lobbies = response.json()
        for lobby in lobbies:
            if lobby["name"] == TEST_NAME:
                lobby_id = lobby["id"]
                break
        await asyncio.sleep(1)
    return lobby_id


async def get_scenarios(token):
    headers = {"authorization": f"Bearer {token}"}
    with httpx.Client() as client:
        response = client.get(
            f"{SERVER_URL}{SCENARIO_ENDPOINT}",
            headers=headers
        )
        response.raise_for_status()
        scenarios = response.json()
    return scenarios


async def create_lobby(token):
    headers = {"authorization": f"Bearer {token}"}
    with httpx.Client() as client:
        response = client.post(
            f"{SERVER_URL}{LOBBY_ENDPOINT}",
            headers=headers,
            json={
                "name": TEST_NAME,
                "max_players": 4,
            }
        )
        response.raise_for_status()
        lobby = response.json()
    return lobby


def master_cmd(args):
    action = {"user_role":"master"}
    action.update(args)
    return action