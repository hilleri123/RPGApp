FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Установка необходимых пакетов
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    python3-dev \
    musl-dev \
    && rm -rf /var/lib/apt/lists/*

# Установка зависимостей
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Копирование проекта
COPY . .

# Создание директорий для статических и медиа файлов
RUN mkdir -p /app/staticfiles /app/mediafiles

# Настройка прав
RUN chmod +x /app/entrypoint.sh

# Скрипт запуска
ENTRYPOINT ["/app/entrypoint.sh"]

# Запуск Gunicorn в продакшене или runserver для разработки
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "your_project.wsgi:application"]
