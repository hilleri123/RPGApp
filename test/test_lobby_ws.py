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
ROOM_ID = "test_room"

# Тестовые пользователи
TEST_USERS = [
    {"username": "a@aa.ru", "password": "111111"},
    {"username": "user@example.com", "password": "string"},
    {"username": "b@b.com", "password": "b"}
]

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

async def websocket_client(token, client_id):
    """Асинхронная работа с WebSocket"""
    headers = {"authorization": f"Bearer {token}"}
    async with websockets.connect(
        f"{WS_URL}/{ROOM_ID}",
        extra_headers=headers
    ) as websocket:
        # Создаем комнату (если нужно)
        await websocket.send(json.dumps({
            "type": "create_room",
            "room_id": ROOM_ID
        }))
        
        # Отправляем файлы
        for i in range(3):
            file_content = f"File content {i} from {client_id}"
            await websocket.send(json.dumps({
                "type": "file_upload",
                "file_name": f"file_{i}.txt",
                "content": file_content
            }))
            await asyncio.sleep(1)
        
        # Получаем ответы
        for _ in range(3):
            response = await websocket.recv()
            print(f"{client_id} received: {response}")

def client_thread(user_index):
    """Поток для каждого клиента"""
    user = TEST_USERS[user_index]
    client_id = f"client_{user_index+1}"
    
    # Получаем токен
    token = get_access_token(user)
    print(f"{client_id} token: {token[:15]}...")
    
    # Создаем новый event loop для потока
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Запускаем WebSocket клиент
    loop.run_until_complete(websocket_client(token, client_id))
    loop.close()

if __name__ == "__main__":
    # Запускаем потоки
    threads = []
    for i in range(3):
        thread = threading.Thread(target=client_thread, args=(i,))
        thread.start()
        threads.append(thread)
    
    # Ожидаем завершения
    for thread in threads:
        thread.join()
    
    print("All clients finished!")
