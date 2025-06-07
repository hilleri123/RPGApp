#!/bin/bash
set -e

# Настройки подключения (по умолчанию для контейнера db)
DB_NAME=${DB_NAME:-rpg_sessions}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

echo "Удаляем все таблицы в базе данных $DB_NAME внутри контейнера db..."

docker-compose exec -T db bash -c "
export PGPASSWORD='$DB_PASSWORD'
psql -U '$DB_USER' -d '$DB_NAME' -Atc \"
DO \\\$\$
DECLARE
    r RECORD;
BEGIN
    EXECUTE 'SET session_replication_role = replica';
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    EXECUTE 'SET session_replication_role = origin';
END
\\\$\$;
\"
"

echo "Все таблицы удалены внутри контейнера db."
