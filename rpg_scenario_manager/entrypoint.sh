#!/bin/bash

# Ожидание доступности PostgreSQL
if [ "$DATABASE" = "postgres" ]
then
    echo "Waiting for postgres..."
    
    while ! nc -z $SQL_HOST $SQL_PORT; do
      sleep 0.1
    done
    
    echo "PostgreSQL started"
fi

# Применение миграций
python manage.py migrate

# Сбор статических файлов
python manage.py collectstatic --noinput

exec "$@"
