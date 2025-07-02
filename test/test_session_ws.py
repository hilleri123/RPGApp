import asyncio
import threading
import httpx
import websockets
import json
import random
import uuid
from common import *




async def send_master_commands(websocket: websockets.WebSocketClientProtocol, token):
    headers = {"authorization": f"Bearer {token}"}
    scenarios = await get_scenarios(token)
    scenarios_ids = [s["id"] for s in scenarios]

    data: dict = json.loads(websocket.recv())
    characters = []
    players = []
    parse_lobby(data)

    def parse_lobby(data: dict):
        lobby = data
        characters = data.get("characters", [])
        players = data.get("players", [])
    while True:
        if len(characters) == 0:
            action = master_cmd({
                "msg_type":"select_scenario", 
                "scenario_id":random.choice(scenarios_ids)
                })
            await websocket.send(json.dumps(action))
            parse_lobby(json.loads(await websocket.recv()))
        

        delay = random.uniform(1, 2)
        await asyncio.sleep(delay)


async def websocket_client_master(token, master_username):
    headers = {"authorization": f"Bearer {token}"}
    lobby = await create_lobby(token)

    async with websockets.connect(
        f"{WS_URL}/{lobby['id']}",
        extra_headers=headers
    ) as websocket:
        await asyncio.gather(
            receive_messages(websocket, master_username)
        )


async def websocket_client(token, client_username):
    """Асинхронная работа с WebSocket"""
    headers = {"authorization": f"Bearer {token}"}

    lobby_id = await find_lobby_id(token)
    
    async with websockets.connect(
        f"{WS_URL}/{lobby_id}",
        extra_headers=headers
    ) as websocket:
        await asyncio.gather(
            receive_messages(websocket, client_username),
            # send_master_commands(websocket)
        )



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
