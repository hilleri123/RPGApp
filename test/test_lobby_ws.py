import asyncio
import threading
import httpx
import websockets
import json
import uuid

# Конфигурация
SERVER_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/lobby/ws"
LOGIN_ENDPOINT = "/auth/login"
LOBBY_ENDPOINT = "/lobby"

# Тестовые пользователи
MASTER_USER = {"username": "a@aa.ru", "password": "111111"}

TEST_USERS = [
    {"username": "user@example.com", "password": "string"},
    {"username": "b@b.com", "password": "b"}
]

TEST_NAME = "test_kaka"

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

async def websocket_client_master(token, master_username):
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

    async with websockets.connect(
        f"{WS_URL}/{lobby['id']}",
        extra_headers=headers
    ) as websocket:
        pass

async def websocket_client(token, client_username):
    """Асинхронная работа с WebSocket"""
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
    async with websockets.connect(
        f"{WS_URL}/{lobby_id}",
        extra_headers=headers
    ) as websocket:
        pass

def client_thread(user, websocket_func):
    username = user["username"]
    token = get_access_token(user)
    print(f"{username} token: {token[:15]}...")
    
    # Создаем новый event loop для потока
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Запускаем WebSocket клиент
    loop.run_until_complete(websocket_func(token, username))
    loop.close()


if __name__ == "__main__":
    threads = []

    thread = threading.Thread(target=client_thread, args=(MASTER_USER, websocket_client_master))
    thread.start()
    threads.append(thread)

    for user in TEST_USERS:
        thread = threading.Thread(target=client_thread, args=(user, websocket_client))
        thread.start()
        threads.append(thread)
    
    # Ожидаем завершения
    for thread in threads:
        thread.join()
    
    print("All clients finished!")
