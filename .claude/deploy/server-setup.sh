#!/bin/bash

# ============================================================================
# Server Setup Script - One-time preparation for Goals Bot
# ============================================================================
# Usage: Run this script on the server via SSH
# Description: Installs Node.js, PM2, creates swap, prepares directories
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_step() { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }

# ============================================================================
# CONFIGURATION
# ============================================================================

BOT_PATH="/var/app/goals-bot"
SWAP_SIZE="1G"

echo ""
echo "=============================================="
echo "  🛠️  Server Setup for Goals Bot"
echo "=============================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root: sudo bash server-setup.sh"
    exit 1
fi

# ============================================================================
# STEP 1: SWAP
# ============================================================================

log_step "Step 1: Configuring Swap"

CURRENT_SWAP=$(free -m | grep Swap | awk '{print $2}')

if [ "$CURRENT_SWAP" -gt 500 ]; then
    log_success "Swap already configured: ${CURRENT_SWAP}MB"
else
    log_info "Creating ${SWAP_SIZE} swap file..."

    # Create swap file
    fallocate -l $SWAP_SIZE /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile

    # Make permanent
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi

    # Configure swappiness
    if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
        echo 'vm.swappiness=10' >> /etc/sysctl.conf
        sysctl -p > /dev/null 2>&1
    fi

    log_success "Swap configured: ${SWAP_SIZE}"
fi

# ============================================================================
# STEP 2: NODE.JS
# ============================================================================

log_step "Step 2: Installing Node.js 20 LTS"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    if [[ "$NODE_VERSION" == v20* ]]; then
        log_success "Node.js already installed: $NODE_VERSION"
    else
        log_warning "Node.js $NODE_VERSION found, upgrading to v20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        log_success "Node.js upgraded: $(node --version)"
    fi
else
    log_info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log_success "Node.js installed: $(node --version)"
fi

# ============================================================================
# STEP 3: PM2
# ============================================================================

log_step "Step 3: Installing PM2"

if command -v pm2 &> /dev/null; then
    log_success "PM2 already installed: $(pm2 --version)"
else
    log_info "Installing PM2..."
    npm install -g pm2
    log_success "PM2 installed: $(pm2 --version)"
fi

# Setup PM2 startup
log_info "Configuring PM2 startup..."
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
log_success "PM2 startup configured"

# ============================================================================
# STEP 4: DIRECTORIES
# ============================================================================

log_step "Step 4: Creating Bot Directories"

mkdir -p ${BOT_PATH}/data
mkdir -p ${BOT_PATH}/logs

chown -R root:root ${BOT_PATH}
chmod -R 755 ${BOT_PATH}

log_success "Directories created: ${BOT_PATH}"

# ============================================================================
# STEP 5: LOGROTATE
# ============================================================================

log_step "Step 5: Configuring Logrotate"

cat > /etc/logrotate.d/goals-bot << 'EOF'
/var/app/goals-bot/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        pm2 reloadLogs > /dev/null 2>&1 || true
    endscript
}
EOF

log_success "Logrotate configured"

# ============================================================================
# STEP 6: CREATE .ENV TEMPLATE
# ============================================================================

log_step "Step 6: Environment File"

if [ -f "${BOT_PATH}/.env" ]; then
    log_success ".env file already exists"
else
    cat > ${BOT_PATH}/.env << 'EOF'
# Telegram Bot Token (get from @BotFather)
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE

# Database (IMPORTANT: absolute path for Prisma in production)
DATABASE_URL="file:/var/app/goals-bot/data/app.db"

# Environment
NODE_ENV=production
DEFAULT_TIMEZONE=Europe/Moscow

# Memory limit
NODE_OPTIONS="--max-old-space-size=256"
EOF

    chmod 600 ${BOT_PATH}/.env
    log_warning ".env template created - EDIT IT with your bot token!"
    log_info "  nano ${BOT_PATH}/.env"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=============================================="
log_success "Server setup complete!"
echo "=============================================="
echo ""

log_info "Current status:"
echo "  Node.js:    $(node --version)"
echo "  npm:        $(npm --version)"
echo "  PM2:        $(pm2 --version)"
echo "  Swap:       $(free -m | grep Swap | awk '{print $2}')MB"
echo "  Bot path:   ${BOT_PATH}"
echo ""

if [ -f "${BOT_PATH}/.env" ] && grep -q "YOUR_BOT_TOKEN_HERE" "${BOT_PATH}/.env"; then
    log_warning "NEXT STEP: Edit .env file with your bot token:"
    echo "  nano ${BOT_PATH}/.env"
    echo ""
fi

log_info "After configuring .env, run deploy-bot.sh from your local machine"
echo ""
