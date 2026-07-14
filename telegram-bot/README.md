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
