#!/bin/bash

# Commlink Setup Script
# One-command setup for getting started quickly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Progress tracking
TOTAL_STEPS=6
CURRENT_STEP=0

print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    COMMLINK SETUP                           ${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo ""
    echo -e "${YELLOW}[$CURRENT_STEP/$TOTAL_STEPS]${NC} $1"
    echo -e "${YELLOW}────────────────────────────────────────────────────────────${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

# Start setup
print_header

# Step 1: Check prerequisites
print_step "Checking prerequisites..."

MISSING_DEPS=0

if ! check_command "node"; then
    echo "  Please install Node.js: https://nodejs.org/"
    MISSING_DEPS=1
fi

if ! check_command "npm"; then
    echo "  npm comes with Node.js"
    MISSING_DEPS=1
fi

if ! check_command "python3"; then
    echo "  Please install Python 3: https://python.org/"
    MISSING_DEPS=1
fi

if ! check_command "pip3" && ! check_command "pip"; then
    echo "  Please install pip: https://pip.pypa.io/"
    MISSING_DEPS=1
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    print_error "Missing dependencies. Please install them and run this script again."
    exit 1
fi

print_success "All prerequisites met!"

# Step 2: Install Node.js dependencies
print_step "Installing Node.js dependencies..."

if [ -f "package.json" ]; then
    npm install
    print_success "Node.js dependencies installed"
else
    print_error "package.json not found. Are you in the commlink directory?"
    exit 1
fi

# Step 3: Install Python dependencies
print_step "Installing Python dependencies..."

# Determine pip command
PIP_CMD="pip3"
if ! command -v pip3 &> /dev/null; then
    PIP_CMD="pip"
fi

# Install training dependencies
if [ -f "training/requirements.txt" ]; then
    $PIP_CMD install -r training/requirements.txt --quiet
    print_success "Training dependencies installed"
else
    print_info "training/requirements.txt not found, installing basics..."
    $PIP_CMD install torch numpy supabase --quiet
    print_success "Basic Python packages installed"
fi

# Step 4: Setup environment file
print_step "Setting up environment configuration..."

if [ -f ".env.local" ]; then
    print_info ".env.local already exists"
    read -p "  Overwrite? (y/N): " OVERWRITE
    if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
        print_info "Keeping existing .env.local"
    else
        cp .env.example .env.local
        print_success "Created .env.local from template"
    fi
else
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_success "Created .env.local from template"
    else
        print_error ".env.example not found"
    fi
fi

echo ""
echo "  To connect to Supabase, edit .env.local with your credentials:"
echo "  - NEXT_PUBLIC_SUPABASE_URL"
echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo ""
echo "  Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api"

# Step 5: Database setup reminder
print_step "Database setup..."

echo "  If this is a fresh Supabase project, run the schema:"
echo ""
echo "  1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new"
echo "  2. Copy contents of: supabase/schema.sql"
echo "  3. Run the SQL"
echo ""
echo "  For existing databases, run the migration:"
echo "  supabase/migrations/001_add_progress_fields.sql"

# Step 6: Seed sample data (optional)
print_step "Seed sample data (optional)..."

if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    read -p "  Seed sample data to populate the dashboard? (y/N): " SEED_DATA
    if [ "$SEED_DATA" == "y" ] || [ "$SEED_DATA" == "Y" ]; then
        echo "  Running seed script..."
        python3 scripts/seed_data.py
        print_success "Sample data seeded!"
    else
        print_info "Skipping seed data"
    fi
else
    print_info "Supabase not configured. Set up .env.local first, then run:"
    echo "    python3 scripts/seed_data.py"
fi

# Summary
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    SETUP COMPLETE!                          ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Configure Supabase credentials in .env.local"
echo "  2. Run the database schema (if new project)"
echo "  3. Seed sample data: python3 scripts/seed_data.py"
echo "  4. Start the dev server: npm run dev"
echo ""
echo "  Quick commands:"
echo "    npm run dev                           # Start frontend"
echo "    python3 scripts/run_local.py --demo   # Run training demo"
echo "    python3 scripts/seed_data.py          # Seed sample data"
echo ""
echo "  Documentation: See CLAUDE.md for full details"
echo ""
