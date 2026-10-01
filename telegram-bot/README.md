# telegram-bot

Отдельный сервис Telegram-бота. Общается с FastAPI (`RPGdata`) только через **RabbitMQ RPC**.

## Команды

| Команда | Где | Действие |
|---------|-----|----------|
| `/start` | личка | Инструкция |
| `/link` | личка | Одноразовая ссылка входа (токен выдаёт бэкенд через RPC) |
| `/создать_лобби Название @p1 @p2` | группа | Создать лобби на бэке и разослать ссылки в ЛС |

## Env

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен Telegram-бота |
| `WEB_CLIENT_URL` | База URL фронта для `/auth/link` |
| `RABBIT_URL` | Например `amqp://rpg:rpg@rabbitmq:5672/` |

## RPC

- Exchange: `rpg.rpc` (direct)
- Queue / routing key: `backend.bot.rpc` / `bot.rpc`
- Methods: `create_link_token`, `create_lobby`

## Локально

```bash
docker compose -f compose.dev.yml up telegram-bot rabbitmq app
```


## Notifications (backend -> bot)

Fire-and-forget events go through exchange `rpg.events` (direct, durable), queue `bot.notify`,
routing key `bot.notify`. The backend declares the queue too, so events survive a bot restart
(message TTL: 1 hour).

| `event` | Payload | Result |
|---------|---------|--------|
| `session_started` | `telegram_id, session_id, lobby_name, scenario_name` | DM «Сессия началась» with buttons «Открыть в Telegram» (Web App on `/session/<id>`, logs in via initData; https only) and «Ссылка для браузера (со входом)» (callback -> fresh one-time `/auth/link?token=...&next=/session/<id>`, 5 min) |

Published from `RPGdata/app/services/bot_notify_service.py` when the master starts a session from
the lobby (the starter is not notified). Consumer: `bot/events.py`.
