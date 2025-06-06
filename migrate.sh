#!/bin/bash
set -e

# Default values
MESSAGE=${1:-"autogenerated migration"}
COMPOSE_FILE=${2:-"docker-compose.yml"}
SERVICE_NAME=${3:-"app"}
ALEMBIC_CMD="alembic upgrade head"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if docker-compose is running
check_docker_compose() {
    if ! docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        echo -e "${YELLOW}Docker Compose services are not running. Please start them first with:${NC}"
        echo "docker-compose -f $COMPOSE_FILE up -d"
        exit 1
    fi
}

# Function to wait for PostgreSQL
wait_for_postgres() {
    echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
    docker-compose -f "$COMPOSE_FILE" exec -T db bash -c '
    until pg_isready -U $POSTGRES_USER -d $POSTGRES_DB; do 
        sleep 2
    done'
}

# Generate migration
generate_migration() {
    echo -e "${YELLOW}Generating new migration...${NC}"
    if ! docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" bash -c "alembic revision --autogenerate -m \"$MESSAGE\""; then
        echo "Failed to generate migration"
        exit 1
    fi
    echo -e "${GREEN}Migration generated successfully!${NC}"
}

# Apply migrations
apply_migrations() {
    echo -e "${YELLOW}Applying migrations...${NC}"
    if ! docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" bash -c "$ALEMBIC_CMD"; then
        echo "Failed to apply migrations"
        exit 1
    fi
    echo -e "${GREEN}Migrations applied successfully!${NC}"
}

# Main execution
echo "Starting migration process..."

# Check if services are running
check_docker_compose

# Wait for PostgreSQL to be ready
wait_for_postgres

# Generate and apply migrations
generate_migration
apply_migrations

echo -e "${GREEN}Migration process completed successfully!${NC}"
