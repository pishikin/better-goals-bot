#!/bin/bash

# ============================================================================
# Deploy Script - Goals Telegram Bot
# ============================================================================
# Usage:
#   1. Copy this file: cp deploy-bot.example.sh deploy-bot.sh
#   2. Fill in your server details below
#   3. Make executable: chmod +x deploy-bot.sh
#   4. Run: ./deploy-bot.sh
# ============================================================================

set -e

# ============================================================================
# SERVER SETTINGS - FILL BEFORE USE
# ============================================================================

# Server IP or domain
SERVER_IP="YOUR_SERVER_IP"

# SSH user
SERVER_USER="root"

# Path to bot directory on server
SERVER_PATH="/var/app/goals-bot"

# SSH password (consider using SSH keys instead)
SERVER_PASSWORD="YOUR_PASSWORD"

# ============================================================================
# SCRIPT SETTINGS (usually no need to change)
# ============================================================================

# Build directory
BUILD_DIR="dist"

# Project root (relative to script location)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Max retry attempts for network errors
MAX_RETRIES=3

# SSH connection timeout
SSH_TIMEOUT=60

# SSH options for stable connection
SSH_OPTIONS="-o ConnectTimeout=${SSH_TIMEOUT} -o ServerAliveInterval=30 -o ServerAliveCountMax=5 -o StrictHostKeyChecking=no"

# Check for sshpass
if command -v sshpass &> /dev/null; then
    SSHPASS_CMD="sshpass -p '${SERVER_PASSWORD}'"
else
    SSHPASS_CMD=""
    echo "WARNING: sshpass not installed. Password will be prompted."
    echo "Install: brew install hudochenkov/sshpass/sshpass"
fi

# ============================================================================
# COLORS
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_step() {
    echo -e "\n${BLUE}$1${NC}"
}

# Check configuration
check_config() {
    local has_error=false

    if [ "$SERVER_IP" = "YOUR_SERVER_IP" ] || [ -z "$SERVER_IP" ]; then
        log_error "Server IP not specified (SERVER_IP)"
        has_error=true
    fi

    if [ "$SERVER_PASSWORD" = "YOUR_PASSWORD" ] || [ -z "$SERVER_PASSWORD" ]; then
        log_error "Server password not specified (SERVER_PASSWORD)"
        has_error=true
    fi

    if [ "$has_error" = true ]; then
        echo ""
        log_error "Please fill in settings at the beginning of deploy-bot.sh"
        exit 1
    fi
}

# Execute command with retries
retry_command() {
    local cmd="$1"
    local description="$2"
    local attempt=1

    while [ $attempt -le $MAX_RETRIES ]; do
        log_info "Attempt $attempt of $MAX_RETRIES: $description"

        if eval "$cmd"; then
            log_success "$description - success"
            return 0
        else
            log_warning "Attempt $attempt failed"
            attempt=$((attempt + 1))

            if [ $attempt -le $MAX_RETRIES ]; then
                log_info "Waiting 5 seconds before retry..."
                sleep 5
            fi
        fi
    done

    log_error "$description - failed after $MAX_RETRIES attempts"
    return 1
}

# Check SSH connection
check_ssh_connection() {
    log_step "🔌 Checking SSH connection..."

    if eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'echo OK'" > /dev/null 2>&1; then
        log_success "SSH connection established"
        return 0
    else
        log_error "Could not establish SSH connection"
        log_info "Check:"
        log_info "  - Server IP: ${SERVER_IP}"
        log_info "  - User: ${SERVER_USER}"
        log_info "  - Password in script settings"
        return 1
    fi
}

# Check server prerequisites
check_server_prerequisites() {
    log_step "🔍 Checking server prerequisites..."

    # Check Node.js
    NODE_VERSION=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'node --version 2>/dev/null || echo NOT_FOUND'")
    if [ "$NODE_VERSION" = "NOT_FOUND" ]; then
        log_error "Node.js not installed on server"
        log_info "Run server preparation steps from BOT_DEPLOYMENT_PLAN.md first"
        exit 1
    else
        log_success "Node.js installed: $NODE_VERSION"
    fi

    # Check PM2
    PM2_VERSION=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'pm2 --version 2>/dev/null || echo NOT_FOUND'")
    if [ "$PM2_VERSION" = "NOT_FOUND" ]; then
        log_error "PM2 not installed on server"
        log_info "Install with: npm install -g pm2"
        exit 1
    else
        log_success "PM2 installed: $PM2_VERSION"
    fi

    # Check bot directory
    DIR_EXISTS=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'test -d ${SERVER_PATH} && echo yes || echo no'")
    if [ "$DIR_EXISTS" = "no" ]; then
        log_info "Creating bot directory..."
        eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'mkdir -p ${SERVER_PATH}/data ${SERVER_PATH}/logs'"
    fi
    log_success "Bot directory ready"

    # Check .env file
    ENV_EXISTS=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'test -f ${SERVER_PATH}/.env && echo yes || echo no'")
    if [ "$ENV_EXISTS" = "no" ]; then
        log_error ".env file not found on server"
        log_info "Create ${SERVER_PATH}/.env with TELEGRAM_BOT_TOKEN and DATABASE_URL"
        exit 1
    else
        log_success ".env file found"
    fi

    # CRITICAL: Check DATABASE_URL uses absolute path (not relative!)
    # Prisma resolves relative paths from schema.prisma location, not cwd
    DB_URL_CHECK=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'grep DATABASE_URL ${SERVER_PATH}/.env'")
    if echo "$DB_URL_CHECK" | grep -q "file:\.\/"; then
        log_error "DATABASE_URL uses relative path! This will cause data loss!"
        log_error "Current: $DB_URL_CHECK"
        log_error "Fix .env on server to use absolute path:"
        log_info "  DATABASE_URL=\"file:${SERVER_PATH}/data/app.db\""
        exit 1
    else
        log_success "DATABASE_URL appears to use absolute path"
    fi

    # Check swap
    SWAP_SIZE=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'free -m | grep Swap | awk \"{print \\\$2}\"'")
    if [ "$SWAP_SIZE" -lt 500 ]; then
        log_warning "Swap is less than 500MB ($SWAP_SIZE MB). Consider adding swap."
    else
        log_success "Swap configured: ${SWAP_SIZE}MB"
    fi
}

# Build project
build_project() {
    log_step "📦 Building project..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --silent

    # Generate Prisma client
    log_info "Generating Prisma client..."
    npx prisma generate

    # Build TypeScript
    log_info "Compiling TypeScript..."
    npm run build

    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory '$BUILD_DIR' not found"
        exit 1
    fi

    if [ ! -f "$BUILD_DIR/index.js" ]; then
        log_error "Entry point '$BUILD_DIR/index.js' not found"
        exit 1
    fi

    BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
    log_success "Build complete: $BUILD_SIZE"
}

# Stop bot before deployment
stop_bot() {
    log_step "⏸️  Stopping bot..."

    eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'pm2 stop goals-bot 2>/dev/null || true'"
    log_success "Bot stopped (or was not running)"
}

# Upload files to server
upload_files() {
    log_step "📤 Uploading files to server..."

    cd "$PROJECT_ROOT"

    # Clean old dist on server (BUT NOT data/ - that's the production database!)
    log_info "Cleaning old build..."
    eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'rm -rf ${SERVER_PATH}/dist ${SERVER_PATH}/node_modules'"

    # Upload dist/
    log_info "Uploading dist/..."
    UPLOAD_CMD="$SSHPASS_CMD scp $SSH_OPTIONS -r ${BUILD_DIR} ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"
    retry_command "$UPLOAD_CMD" "Upload dist/"

    # Upload prisma/ (schema and migrations only, NOT data/)
    log_info "Uploading prisma/ (excluding data/)..."
    # First, clean old prisma folder on server (except data/)
    eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'rm -rf ${SERVER_PATH}/prisma/migrations ${SERVER_PATH}/prisma/schema.prisma'"
    # Create prisma directory if needed
    eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'mkdir -p ${SERVER_PATH}/prisma'"
    # Upload schema
    UPLOAD_CMD="$SSHPASS_CMD scp $SSH_OPTIONS prisma/schema.prisma ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/prisma/"
    retry_command "$UPLOAD_CMD" "Upload schema.prisma"
    # Upload migrations folder
    UPLOAD_CMD="$SSHPASS_CMD scp $SSH_OPTIONS -r prisma/migrations ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/prisma/"
    retry_command "$UPLOAD_CMD" "Upload migrations/"

    # Upload package files
    log_info "Uploading package.json..."
    UPLOAD_CMD="$SSHPASS_CMD scp $SSH_OPTIONS package.json package-lock.json ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"
    retry_command "$UPLOAD_CMD" "Upload package files"

    log_success "Files uploaded"
}

# Install dependencies on server
install_dependencies() {
    log_step "📥 Installing dependencies on server..."

    INSTALL_CMD="$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'cd ${SERVER_PATH} && npm ci --omit=dev --silent'"

    if retry_command "$INSTALL_CMD" "Install production dependencies"; then
        log_success "Dependencies installed"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log_step "🗄️  Running database migrations..."

    MIGRATE_CMD="$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'cd ${SERVER_PATH} && npx prisma migrate deploy'"

    if eval "$MIGRATE_CMD"; then
        log_success "Migrations complete"
    else
        log_warning "Migration failed or no migrations to run"
    fi

    # Generate Prisma client on server
    log_info "Generating Prisma client on server..."
    eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'cd ${SERVER_PATH} && npx prisma generate'"
}

# Create PM2 ecosystem config
create_pm2_config() {
    log_step "⚙️  Creating PM2 configuration..."

    # Use .cjs extension for CommonJS compatibility with ES modules project
    PM2_CONFIG="module.exports = {
  apps: [{
    name: 'goals-bot',
    script: 'dist/index.js',
    cwd: '${SERVER_PATH}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=256'
    },
    error_file: '${SERVER_PATH}/logs/error.log',
    out_file: '${SERVER_PATH}/logs/out.log',
    log_file: '${SERVER_PATH}/logs/combined.log',
    time: true
  }]
};"

    # Remove old .js config if exists, create .cjs
    eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'rm -f ${SERVER_PATH}/ecosystem.config.js'"
    echo "$PM2_CONFIG" | eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'cat > ${SERVER_PATH}/ecosystem.config.cjs'"
    log_success "PM2 config created (ecosystem.config.cjs)"
}

# Start bot
start_bot() {
    log_step "🚀 Starting bot..."

    # Start or restart with PM2 (using .cjs for ES modules compatibility)
    START_CMD="$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'cd ${SERVER_PATH} && pm2 start ecosystem.config.cjs'"

    if eval "$START_CMD"; then
        log_success "Bot started"
    else
        log_error "Failed to start bot"
        exit 1
    fi

    # Save PM2 process list
    eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'pm2 save'"
}

# Verify bot is running
verify_bot() {
    log_step "✅ Verifying bot status..."

    sleep 3  # Wait for bot to initialize

    STATUS=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'pm2 jlist' 2>/dev/null" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ "$STATUS" = "online" ]; then
        log_success "Bot is running!"
    else
        log_error "Bot status: $STATUS"
        log_info "Check logs with: pm2 logs goals-bot"
        exit 1
    fi

    # Show memory usage
    MEMORY=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'pm2 jlist'" 2>/dev/null | grep -o '"memory":[0-9]*' | head -1 | cut -d':' -f2)
    if [ -n "$MEMORY" ]; then
        MEMORY_MB=$((MEMORY / 1024 / 1024))
        log_info "Memory usage: ${MEMORY_MB}MB"
    fi
}

# ============================================================================
# MAIN PROCESS
# ============================================================================

echo ""
echo "=============================================="
echo "  🤖 Deploying Goals Telegram Bot"
echo "=============================================="
echo ""

# Check configuration
check_config

# Check SSH connection
check_ssh_connection || exit 1

# Check server prerequisites
check_server_prerequisites

# Build project
build_project

# Stop bot before deployment
stop_bot

# Upload files
upload_files

# Install dependencies on server
install_dependencies

# Run migrations
run_migrations

# Create PM2 config
create_pm2_config

# Start bot
start_bot

# Verify
verify_bot

# Done
echo ""
echo "=============================================="
log_success "Bot deployment complete!"
echo "=============================================="
echo ""

log_info "Useful commands (on server):"
echo "  pm2 status          - Check bot status"
echo "  pm2 logs goals-bot  - View logs"
echo "  pm2 restart goals-bot - Restart bot"
echo "  pm2 monit           - Monitor resources"
echo ""

# Check landing is still working
log_info "Verifying landing page is unaffected..."
NGINX_STATUS=$(eval "$SSHPASS_CMD ssh $SSH_OPTIONS ${SERVER_USER}@${SERVER_IP} 'systemctl is-active nginx'" 2>/dev/null)
if [ "$NGINX_STATUS" = "active" ]; then
    log_success "Nginx is running - landing page OK"
else
    log_warning "Nginx status: $NGINX_STATUS"
fi

echo ""
