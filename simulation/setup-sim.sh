#!/bin/bash

# Commlink Simulation Setup
# Downloads and builds PX4 SITL for drone simulation
#
# This only needs to be run once. Takes 10-20 minutes depending on internet/CPU.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           COMMLINK SIMULATION SETUP                         ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is available"

# Check docker-compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} docker-compose is available"
echo ""

# Create worlds directory for custom Gazebo environments
mkdir -p worlds

echo -e "${YELLOW}This will download and build PX4 SITL (~2GB download, 10-20 min build)${NC}"
echo ""
read -p "Continue? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${BLUE}[1/3]${NC} Pulling Docker image..."
docker pull px4io/px4-dev-simulation-focal:latest

echo ""
echo -e "${BLUE}[2/3]${NC} Cloning PX4-Autopilot (this takes a few minutes)..."

# Run container to clone PX4 into the volume
docker run --rm \
    -v commlink-px4-source:/src/PX4-Autopilot \
    px4io/px4-dev-simulation-focal:latest \
    bash -c "
        if [ -d /src/PX4-Autopilot/.git ]; then
            echo 'PX4 already cloned, updating...'
            cd /src/PX4-Autopilot
            git fetch origin main
            git reset --hard origin/main
        else
            echo 'Cloning PX4-Autopilot...'
            git clone --recursive --depth 1 https://github.com/PX4/PX4-Autopilot.git /src/PX4-Autopilot
        fi
    "

echo ""
echo -e "${BLUE}[3/3]${NC} Building PX4 SITL (this takes 10-15 minutes)..."

# Build PX4 SITL
docker run --rm \
    -v commlink-px4-source:/src/PX4-Autopilot \
    -w /src/PX4-Autopilot \
    px4io/px4-dev-simulation-focal:latest \
    bash -c "
        echo 'Building PX4 SITL...'
        make px4_sitl_default
        echo ''
        echo 'Build complete!'
    "

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           SETUP COMPLETE!                                   ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Run the simulation:"
echo ""
echo "    # With Gazebo GUI (requires X11):"
echo "    docker-compose up px4-gazebo"
echo ""
echo "    # Headless mode (no GUI, faster):"
echo "    docker-compose --profile headless up"
echo ""
echo "    # With data collection agent:"
echo "    RUN_ID=<uuid> docker-compose --profile with-agent up"
echo ""
echo "  Connect QGroundControl to: udp://localhost:14550"
echo ""
