#!/usr/bin/env python3
"""
MAVLink Agent for Drone Control and Data Collection

This agent connects to PX4 SITL via MAVLink, executes flight scenarios,
and collects training data (state, actions, images).
"""

import asyncio
import json
import os
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np

try:
    from mavsdk import System
    from mavsdk.offboard import OffboardError, PositionNedYaw, VelocityNedYaw
except ImportError:
    print("MAVSDK not installed. Install with: pip install mavsdk")
    System = None

try:
    from supabase import create_client, Client
except ImportError:
    print("Supabase not installed. Install with: pip install supabase")
    create_client = None


@dataclass
class DroneState:
    """Current drone state."""
    timestamp: float
    position: tuple[float, float, float]  # x, y, z (NED frame, meters)
    velocity: tuple[float, float, float]  # vx, vy, vz (m/s)
    orientation: tuple[float, float, float]  # roll, pitch, yaw (radians)
    angular_velocity: tuple[float, float, float]  # wx, wy, wz (rad/s)


@dataclass
class DroneAction:
    """Action commanded to drone."""
    throttle: float  # 0-1
    roll: float  # -1 to 1
    pitch: float  # -1 to 1
    yaw: float  # -1 to 1


@dataclass
class Frame:
    """Single frame of collected data."""
    timestamp: float
    state: DroneState
    action: DroneAction
    image: Optional[np.ndarray] = None


class DataCollector:
    """Collects and stores episode data."""

    def __init__(self, output_dir: str = "./data"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.frames: list[Frame] = []
        self.episode_id: Optional[str] = None

    def start_episode(self, episode_id: str):
        """Start a new episode."""
        self.episode_id = episode_id
        self.frames = []
        print(f"Started episode: {episode_id}")

    def record_frame(self, state: DroneState, action: DroneAction, image: Optional[np.ndarray] = None):
        """Record a single frame."""
        frame = Frame(
            timestamp=time.time(),
            state=state,
            action=action,
            image=image
        )
        self.frames.append(frame)

    def save_episode(self) -> str:
        """Save episode to disk and return the file path."""
        if not self.episode_id:
            raise ValueError("No episode started")

        episode_path = self.output_dir / f"{self.episode_id}.json"

        # Convert frames to serializable format
        data = {
            "episode_id": self.episode_id,
            "num_frames": len(self.frames),
            "frames": [
                {
                    "timestamp": f.timestamp,
                    "state": {
                        "timestamp": f.state.timestamp,
                        "position": list(f.state.position),
                        "velocity": list(f.state.velocity),
                        "orientation": list(f.state.orientation),
                        "angular_velocity": list(f.state.angular_velocity),
                    },
                    "action": asdict(f.action),
                }
                for f in self.frames
            ]
        }

        # Save images separately as numpy arrays
        if any(f.image is not None for f in self.frames):
            images_path = self.output_dir / f"{self.episode_id}_images.npz"
            images = {
                f"frame_{i}": f.image
                for i, f in enumerate(self.frames)
                if f.image is not None
            }
            np.savez_compressed(images_path, **images)
            data["images_path"] = str(images_path)

        with open(episode_path, "w") as f:
            json.dump(data, f, indent=2)

        print(f"Saved episode with {len(self.frames)} frames to {episode_path}")
        return str(episode_path)


class MAVLinkAgent:
    """Agent for controlling drone via MAVLink and collecting data."""

    def __init__(self, connection_string: str = "udp://:14540"):
        self.connection_string = connection_string
        self.drone: Optional[System] = None
        self.collector = DataCollector()
        self.current_state: Optional[DroneState] = None
        self.is_collecting = False

        # Supabase client for uploading results
        self.supabase: Optional[Client] = None
        self._init_supabase()

    def _init_supabase(self):
        """Initialize Supabase client if credentials are available."""
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if url and key and create_client:
            self.supabase = create_client(url, key)
            print("Supabase client initialized")

    async def connect(self):
        """Connect to the drone."""
        if System is None:
            raise RuntimeError("MAVSDK not available")

        self.drone = System()
        await self.drone.connect(system_address=self.connection_string)

        print("Waiting for drone to connect...")
        async for state in self.drone.core.connection_state():
            if state.is_connected:
                print("Drone connected!")
                break

        print("Waiting for global position estimate...")
        async for health in self.drone.telemetry.health():
            if health.is_global_position_ok and health.is_home_position_ok:
                print("Global position estimate OK")
                break

    async def _update_state(self):
        """Background task to continuously update drone state."""
        async for position in self.drone.telemetry.position():
            velocity = await self.drone.telemetry.velocity_ned().__anext__()
            attitude = await self.drone.telemetry.attitude_euler().__anext__()
            angular = await self.drone.telemetry.attitude_angular_velocity_body().__anext__()

            self.current_state = DroneState(
                timestamp=time.time(),
                position=(position.latitude_deg, position.longitude_deg, position.relative_altitude_m),
                velocity=(velocity.north_m_s, velocity.east_m_s, velocity.down_m_s),
                orientation=(attitude.roll_deg, attitude.pitch_deg, attitude.yaw_deg),
                angular_velocity=(angular.roll_rad_s, angular.pitch_rad_s, angular.yaw_rad_s),
            )

    async def arm_and_takeoff(self, altitude: float = 10.0):
        """Arm the drone and take off to specified altitude."""
        print("Arming...")
        await self.drone.action.arm()

        print(f"Taking off to {altitude}m...")
        await self.drone.action.set_takeoff_altitude(altitude)
        await self.drone.action.takeoff()

        # Wait for takeoff to complete
        await asyncio.sleep(5)
        print("Takeoff complete")

    async def land(self):
        """Land the drone."""
        print("Landing...")
        await self.drone.action.land()

        # Wait for landing
        async for in_air in self.drone.telemetry.in_air():
            if not in_air:
                print("Landed")
                break

    async def goto_position(self, x: float, y: float, z: float, yaw: float = 0.0):
        """Go to a position in NED frame."""
        await self.drone.offboard.set_position_ned(
            PositionNedYaw(x, y, -z, yaw)  # z is negative in NED (down is positive)
        )

    async def run_scenario(self, waypoints: list[dict], duration: float = 60.0):
        """
        Execute a flight scenario defined by waypoints.

        Args:
            waypoints: List of {x, y, z, yaw?} dictionaries
            duration: Maximum duration in seconds
        """
        episode_id = f"ep_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.collector.start_episode(episode_id)
        self.is_collecting = True

        try:
            # Start offboard mode
            await self.drone.offboard.set_position_ned(
                PositionNedYaw(0.0, 0.0, -10.0, 0.0)
            )
            await self.drone.offboard.start()

            start_time = time.time()
            waypoint_idx = 0

            while time.time() - start_time < duration and waypoint_idx < len(waypoints):
                wp = waypoints[waypoint_idx]
                target_x = wp.get("x", 0)
                target_y = wp.get("y", 0)
                target_z = wp.get("z", 10)
                target_yaw = wp.get("yaw", 0)

                print(f"Going to waypoint {waypoint_idx + 1}: ({target_x}, {target_y}, {target_z})")

                await self.goto_position(target_x, target_y, target_z, target_yaw)

                # Collect data while moving to waypoint
                for _ in range(50):  # ~5 seconds at 10Hz
                    if self.current_state:
                        action = DroneAction(
                            throttle=0.5,  # Placeholder - would compute from actual commands
                            roll=0.0,
                            pitch=0.0,
                            yaw=target_yaw / 180.0,  # Normalize
                        )
                        self.collector.record_frame(self.current_state, action)

                    await asyncio.sleep(0.1)

                waypoint_idx += 1

            # Stop offboard mode
            await self.drone.offboard.stop()

        except Exception as e:
            print(f"Error during scenario: {e}")
            raise
        finally:
            self.is_collecting = False

        # Save episode
        episode_path = self.collector.save_episode()
        return episode_id, episode_path, len(self.collector.frames)

    async def upload_episode(self, run_id: str, scenario_id: str, episode_path: str, num_frames: int):
        """Upload episode metadata to Supabase."""
        if not self.supabase:
            print("Supabase not configured, skipping upload")
            return

        # TODO: Upload actual data file to Supabase Storage
        # For now, just record metadata
        self.supabase.table("episodes").insert({
            "run_id": run_id,
            "scenario_id": scenario_id,
            "data_url": episode_path,  # Would be storage URL in production
            "frames": num_frames,
        }).execute()

        print(f"Uploaded episode metadata to Supabase")


async def main():
    """Main entry point."""
    connection = os.getenv("PX4_CONNECTION", "udp://:14540")
    run_id = os.getenv("RUN_ID")
    scenario_id = os.getenv("SCENARIO_ID")

    agent = MAVLinkAgent(connection)

    try:
        await agent.connect()

        # Start state update task
        asyncio.create_task(agent._update_state())

        # Arm and takeoff
        await agent.arm_and_takeoff(10.0)

        # Example scenario - square pattern
        waypoints = [
            {"x": 0, "y": 0, "z": 10},
            {"x": 10, "y": 0, "z": 10},
            {"x": 10, "y": 10, "z": 10},
            {"x": 0, "y": 10, "z": 10},
            {"x": 0, "y": 0, "z": 10},
        ]

        episode_id, episode_path, num_frames = await agent.run_scenario(waypoints)

        # Upload to Supabase if configured
        if run_id and scenario_id:
            await agent.upload_episode(run_id, scenario_id, episode_path, num_frames)

        # Land
        await agent.land()

    except KeyboardInterrupt:
        print("Interrupted")
    finally:
        if agent.drone:
            await agent.drone.action.land()


if __name__ == "__main__":
    asyncio.run(main())
