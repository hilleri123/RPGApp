.PHONY: dev prod down logs clean

# Colors for output
GREEN := \033[0;32m
NC := \033[0m # No Color

dev: ## Запустить в режиме разработки
	@echo "$(GREEN)Запуск в режиме разработки...$(NC)"
	docker-compose up app frontend-dev

prod: ## Запустить в режиме production
	@echo "$(GREEN)Запуск в режиме продакшена...$(NC)"
	docker-compose --profile prod up -d

down: ## Остановить контейнеры
	@echo "$(GREEN)Остановка контейнеров...$(NC)"
	docker-compose down

logs: ## Показать логи
	@echo "$(GREEN)Просмотр логов...$(NC)"
	docker-compose logs -f

clean: down ## Очистка Docker
	@echo "$(GREEN)Очистка контейнеров и образов...$(NC)"
	docker-compose down -v --rmi local
