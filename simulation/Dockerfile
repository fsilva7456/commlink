# PX4 SITL + Gazebo Simulation Environment
FROM px4io/px4-dev-simulation-focal:latest

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    pymavlink \
    mavsdk \
    numpy \
    opencv-python-headless \
    requests \
    supabase

# Set working directory
WORKDIR /app

# Copy simulation scripts
COPY . /app/

# Environment variables for PX4
ENV PX4_HOME=/root/PX4-Autopilot
ENV PATH="${PX4_HOME}/Tools:${PATH}"

# Default command
CMD ["python3", "agent.py"]
