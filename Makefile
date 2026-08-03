.PHONY: dev prod down logs clean test migrate help

# Colors for output
GREEN := \033[0;32m
NC := \033[0m # No Color

DEV  := docker compose -f compose.dev.yml
PROD := docker compose -f compose.prod.yml

help: ## Показать список целей
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-10s$(NC) %s\n", $$1, $$2}'

dev: ## Запустить в режиме разработки
	@echo "$(GREEN)Запуск в режиме разработки...$(NC)"
	$(DEV) up app web-client

prod: ## Запустить в режиме production
	@echo "$(GREEN)Запуск в режиме продакшена...$(NC)"
	$(PROD) up -d

down: ## Остановить контейнеры
	@echo "$(GREEN)Остановка контейнеров...$(NC)"
	$(DEV) down

logs: ## Показать логи
	@echo "$(GREEN)Просмотр логов...$(NC)"
	$(DEV) logs -f

test: ## Прогнать тесты бэкенда
	@echo "$(GREEN)Тесты...$(NC)"
	$(DEV) exec -T app python -m pytest tests/ -q

migrate: ## Применить миграции
	@echo "$(GREEN)Миграции...$(NC)"
	$(DEV) exec -T app alembic upgrade head

clean: down ## Очистка Docker
	@echo "$(GREEN)Очистка контейнеров и образов...$(NC)"
	$(DEV) down -v --rmi local
