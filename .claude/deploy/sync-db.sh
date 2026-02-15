#!/bin/bash

# ============================================================================
# Database Sync Script
# ============================================================================
# Usage:
#   ./sync-db.sh pull          # remote -> local (safe default)
#   ./sync-db.sh push --force  # local -> remote (dangerous, requires --force)
# ============================================================================

set -e

MODE="${1:-pull}"
FORCE_FLAG="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Server settings (match other deploy scripts)
SERVER_IP="185.195.27.51"
SERVER_USER="root"
SERVER_PASSWORD="b7zmplYx3i91"
SERVER_PATH="/var/app/goals-bot"
SERVER_DB_PATH="${SERVER_PATH}/data/app.db"

SSH_OPTIONS="-o ConnectTimeout=60 -o ServerAliveInterval=30 -o ServerAliveCountMax=5 -o StrictHostKeyChecking=no"

if command -v sshpass &> /dev/null; then
    SSHPASS_CMD="sshpass -p '${SERVER_PASSWORD}'"
else
    SSHPASS_CMD=""
fi

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }

cd "$PROJECT_ROOT"

if [ "$MODE" = "pull" ]; then
    log_info "Sync mode: pull (remote -> local)"

    # Create backups on both sides first.
    "${SCRIPT_DIR}/backup-db.sh" both

    # Download fresh remote DB and overwrite local testing DB.
    log_info "Downloading remote DB..."
    mkdir -p ./backups/remote
    TEMP_FILE="./backups/remote/pull_$(date +"%Y%m%d_%H%M%S").db"
    eval "$SSHPASS_CMD scp $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP}:${SERVER_DB_PATH} ${TEMP_FILE}"

    mkdir -p ./data
    cp "${TEMP_FILE}" ./data/app.db

    log_success "Local database updated from remote: ./data/app.db"
    exit 0
fi

if [ "$MODE" = "push" ]; then
    if [ "$FORCE_FLAG" != "--force" ]; then
        log_error "Push mode is destructive and requires explicit confirmation."
        echo "Usage: ./sync-db.sh push --force"
        exit 1
    fi

    if [ ! -f "./data/app.db" ]; then
        log_error "Local database not found: ./data/app.db"
        exit 1
    fi

    log_warning "Sync mode: push (local -> remote)"
    log_warning "Remote database will be replaced."

    # Create backups on both sides first.
    "${SCRIPT_DIR}/backup-db.sh" both

    log_info "Uploading local DB to remote..."
    eval "$SSHPASS_CMD scp $SSH_OPTIONS ./data/app.db ${SERVER_USER}@${SERVER_IP}:${SERVER_DB_PATH}"

    log_success "Remote database replaced with local copy"
    exit 0
fi

log_error "Unknown mode: $MODE"
echo "Usage:"
echo "  ./sync-db.sh pull"
echo "  ./sync-db.sh push --force"
exit 1

