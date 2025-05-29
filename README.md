# RPG Game Manager

Система для управления RPG сценариями и игровыми сессиями.

## Компоненты

- **RPGdata** - Основной бекенд (FastAPI)
  - Управление сценариями
  - Управление сессиями
  - Аутентификация
  - Работа с файлами (MinIO)
  - PostgreSQL для сценариев
  - MongoDB для сессий

- **RPGFrontendReact** - Интерфейс для управления сценариями (React)
  - Порт: 3001
  - Редактирование сценариев
  - Управление ресурсами

- **RPGWebMainClient** - Интерфейс для игровых сессий (Next.js)
  - Порт: 3000
  - Управление сессиями
  - Игровой процесс

## Запуск

1. Создайте файл `.env.minio`:

```env
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

2. Запустите сервисы:

```bash
docker-compose up -d
```

3. Настройте фронтенд RPGFrontendReact:
   - Следуйте инструкциям в `RPGFrontendReact/README.md`

4. Настройте фронтенд RPGWebMainClient:
   - Следуйте инструкциям в `RPGWebMainClient/README.md`

## Порты

- Backend API (RPGdata): http://localhost:8000
- RPGFrontendReact: http://localhost:3001
- RPGWebMainClient: http://localhost:3000
- PostgreSQL: localhost:5432
- MongoDB: localhost:27017
- MinIO: 
  - API: http://localhost:9000
  - Console: http://localhost:9001

## Разработка

1. Бекенд (RPGdata):
   - FastAPI для API
   - PostgreSQL для хранения сценариев
   - MongoDB для хранения сессий
   - MinIO для хранения файлов

2. Фронтенд для сценариев (RPGFrontendReact):
   - React
   - Material-UI
   - Redux для управления состоянием

3. Фронтенд для сессий (RPGWebMainClient):
   - Next.js
   - Tailwind CSS
   - shadcn/ui компоненты

## Примечания

- Все сервисы настроены для работы в Docker
- Для разработки рекомендуется использовать Docker Compose
- Данные PostgreSQL и MongoDB сохраняются в Docker volumes 