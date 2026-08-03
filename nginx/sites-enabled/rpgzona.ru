# nginx работает на хосте, поэтому проксировать нужно на порты, которые
# compose.prod.yml публикует наружу (6602 → web-client:3000, 6601 → app:8000),
# а не на внутренние порты контейнеров. Домен и сертификаты — те же, что в
# compose.prod.yml (BASE_URL / WEB_CLIENT_URL).

upstream rpg_web_client {
    server 127.0.0.1:6602;
}

upstream rpg_api {
    server 127.0.0.1:6601;
}

server {
    server_name rpgzona.ru www.rpgzona.ru;

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/rpgzona.ru/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/rpgzona.ru/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

    # Загрузка карт и аудио: дефолтного лимита в 1 МБ не хватает.
    client_max_body_size 64m;

    location / {
        proxy_pass http://rpg_web_client;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://rpg_api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Сессии живут на WebSocket: таймаут по умолчанию рвёт игру каждую минуту.
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

server {
    if ($host = rpgzona.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = www.rpgzona.ru) {
        return 301 https://rpgzona.ru$request_uri;
    } # managed by Certbot

    listen 80;
    server_name rpgzona.ru www.rpgzona.ru;
    return 404; # managed by Certbot
}
