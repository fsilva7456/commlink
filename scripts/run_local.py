#!/usr/bin/env python3
"""
Local Runner for Commlink

Orchestrates the full training loop locally:
1. Fetch run configuration from Supabase
2. Run data collection (simulation or dummy data)
3. Train world model
4. Evaluate and upload results

Usage:
    python scripts/run_local.py --run-id <uuid>
    python scripts/run_local.py --demo  # Run with dummy data
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "training"))

try:
    from supabase import create_client, Client
except ImportError:
    print("Supabase not installed. Run: pip install supabase")
    create_client = None


def get_supabase_client() -> Client:
    """Create Supabase client from environment variables."""
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        raise ValueError(
            "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and "
            "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
        )

    return create_client(url, key)


def fetch_run_config(supabase: Client, run_id: str) -> dict:
    """Fetch run configuration from Supabase."""
    result = supabase.table("runs").select("*").eq("id", run_id).single().execute()
    return result.data


def update_run_status(supabase: Client, run_id: str, status: str):
    """Update run status in Supabase."""
    supabase.table("runs").update({"status": status}).eq("id", run_id).execute()
    print(f"Updated run status to: {status}")


def generate_dummy_data(output_dir: str, num_episodes: int = 5, frames_per_episode: int = 100):
    """Generate dummy episode data for testing."""
    import numpy as np

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    for ep in range(num_episodes):
        episode_id = f"dummy_ep_{ep:03d}"
        frames = []

        # Generate circular trajectory
        t = np.linspace(0, 2 * np.pi, frames_per_episode)

        for i, ti in enumerate(t):
            frame = {
                "timestamp": time.time() + i * 0.1,
                "state": {
                    "timestamp": time.time() + i * 0.1,
                    "position": [float(np.cos(ti) * 10), float(np.sin(ti) * 10), 10.0],
                    "velocity": [float(-np.sin(ti) * 10), float(np.cos(ti) * 10), 0.0],
                    "orientation": [0.0, 0.0, float(ti)],
                    "angular_velocity": [0.0, 0.0, 1.0],
                },
                "action": {
                    "throttle": 0.5,
                    "roll": 0.0,
                    "pitch": 0.0,
                    "yaw": 0.1,
                }
            }
            frames.append(frame)

        episode_data = {
            "episode_id": episode_id,
            "num_frames": len(frames),
            "frames": frames,
        }

        with open(output_path / f"{episode_id}.json", "w") as f:
            json.dump(episode_data, f)

        print(f"Generated episode: {episode_id} ({len(frames)} frames)")

    return num_episodes


def run_training(
    run_id: str,
    data_dir: str,
    epochs: int = 100,
    batch_size: int = 32,
    lr: float = 1e-4,
):
    """Run the training script."""
    cmd = [
        sys.executable,
        str(PROJECT_ROOT / "training" / "train.py"),
        "--data-dir", data_dir,
        "--epochs", str(epochs),
        "--batch-size", str(batch_size),
        "--lr", str(lr),
        "--run-id", run_id,
        "--checkpoint-dir", str(PROJECT_ROOT / "checkpoints" / run_id),
    ]

    print(f"\nRunning training command:")
    print(" ".join(cmd))
    print()

    result = subprocess.run(cmd)
    return result.returncode == 0


def run_demo():
    """Run a demo with dummy data (no Supabase required)."""
    print("=" * 60)
    print("COMMLINK LOCAL DEMO")
    print("=" * 60)
    print()

    # Generate dummy data
    data_dir = str(PROJECT_ROOT / "data" / "demo")
    print("Step 1: Generating dummy training data...")
    generate_dummy_data(data_dir, num_episodes=5, frames_per_episode=100)
    print()

    # Run training
    print("Step 2: Training world model...")
    cmd = [
        sys.executable,
        str(PROJECT_ROOT / "training" / "train.py"),
        "--use-dummy-data",
        "--epochs", "20",
        "--batch-size", "16",
        "--checkpoint-dir", str(PROJECT_ROOT / "checkpoints" / "demo"),
    ]

    print(f"Command: {' '.join(cmd)}")
    print()

    subprocess.run(cmd)

    print()
    print("=" * 60)
    print("DEMO COMPLETE")
    print("=" * 60)
    print()
    print("Checkpoints saved to: checkpoints/demo/")
    print()
    print("To run with your own data:")
    print("  1. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
    print("  2. Create a run in the Commlink dashboard")
    print("  3. Run: python scripts/run_local.py --run-id <your-run-id>")


def main():
    parser = argparse.ArgumentParser(description="Run Commlink training locally")
    parser.add_argument("--run-id", type=str, help="Supabase run ID")
    parser.add_argument("--demo", action="store_true", help="Run demo with dummy data")
    parser.add_argument("--epochs", type=int, default=100, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    args = parser.parse_args()

    if args.demo:
        run_demo()
        return

    if not args.run_id:
        print("Error: --run-id is required (or use --demo for demo mode)")
        sys.exit(1)

    # Initialize Supabase
    print("Connecting to Supabase...")
    supabase = get_supabase_client()

    # Fetch run configuration
    print(f"Fetching run configuration for: {args.run_id}")
    run_config = fetch_run_config(supabase, args.run_id)

    if not run_config:
        print(f"Error: Run {args.run_id} not found")
        sys.exit(1)

    print(f"Run: {run_config['name']}")
    print(f"Status: {run_config['status']}")
    print(f"Config: {json.dumps(run_config.get('config', {}), indent=2)}")
    print()

    # Data directory
    data_dir = str(PROJECT_ROOT / "data" / args.run_id)

    # Check for existing data or generate dummy data
    if not Path(data_dir).exists() or not list(Path(data_dir).glob("*.json")):
        print("No episode data found. Generating dummy data for testing...")
        os.makedirs(data_dir, exist_ok=True)
        generate_dummy_data(data_dir)

    # Update status
    update_run_status(supabase, args.run_id, "training")

    # Run training
    config = run_config.get("config", {})
    success = run_training(
        run_id=args.run_id,
        data_dir=data_dir,
        epochs=config.get("epochs", args.epochs),
        batch_size=config.get("batch_size", args.batch_size),
        lr=config.get("learning_rate", args.lr),
    )

    # Update final status
    if success:
        update_run_status(supabase, args.run_id, "completed")
        print("\nTraining completed successfully!")
    else:
        update_run_status(supabase, args.run_id, "failed")
        print("\nTraining failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
