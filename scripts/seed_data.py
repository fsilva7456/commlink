#!/usr/bin/env python3
"""
Seed sample data into Supabase for demo/development.

Creates sample scenarios, runs, metrics, and models so the dashboard
looks populated and functional on first visit.

Usage:
    python scripts/seed_data.py
    python scripts/seed_data.py --clear  # Clear existing data first
"""

import argparse
import os
import sys
from datetime import datetime, timedelta
import random
import math

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package not installed")
    print("Run: pip install supabase")
    sys.exit(1)


def get_supabase_client() -> Client:
    """Create Supabase client from environment variables."""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        print("Error: Supabase credentials not found")
        print("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables")
        print("Or create a .env.local file with these values")
        sys.exit(1)

    return create_client(url, key)


def clear_data(supabase: Client):
    """Clear all existing data."""
    print("Clearing existing data...")
    # Delete in order to respect foreign keys
    supabase.table("metrics").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("episodes").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("models").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("runs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("scenarios").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("Data cleared.")


def seed_scenarios(supabase: Client) -> list[str]:
    """Create sample scenarios and return their IDs."""
    print("Creating scenarios...")

    scenarios = [
        {
            "name": "Square Pattern",
            "environment": "empty_world",
            "waypoints": [
                {"x": 0, "y": 0, "z": 10},
                {"x": 20, "y": 0, "z": 10},
                {"x": 20, "y": 20, "z": 10},
                {"x": 0, "y": 20, "z": 10},
                {"x": 0, "y": 0, "z": 10},
            ],
            "duration": 120,
            "config": {"wind_speed": 0, "obstacles": False}
        },
        {
            "name": "Figure-8 Flight",
            "environment": "empty_world",
            "waypoints": [
                {"x": 0, "y": 0, "z": 10},
                {"x": 10, "y": 10, "z": 10},
                {"x": 20, "y": 0, "z": 10},
                {"x": 10, "y": -10, "z": 10},
                {"x": 0, "y": 0, "z": 10},
                {"x": -10, "y": -10, "z": 10},
                {"x": -20, "y": 0, "z": 10},
                {"x": -10, "y": 10, "z": 10},
                {"x": 0, "y": 0, "z": 10},
            ],
            "duration": 180,
            "config": {"wind_speed": 2, "obstacles": False}
        },
        {
            "name": "Altitude Variation",
            "environment": "empty_world",
            "waypoints": [
                {"x": 0, "y": 0, "z": 5},
                {"x": 10, "y": 0, "z": 15},
                {"x": 20, "y": 0, "z": 5},
                {"x": 30, "y": 0, "z": 20},
                {"x": 40, "y": 0, "z": 10},
            ],
            "duration": 150,
            "config": {"wind_speed": 0, "obstacles": False}
        },
        {
            "name": "Urban Navigation",
            "environment": "urban_world",
            "waypoints": [
                {"x": 0, "y": 0, "z": 15},
                {"x": 15, "y": 10, "z": 20},
                {"x": 30, "y": 5, "z": 15},
                {"x": 25, "y": -10, "z": 25},
                {"x": 10, "y": -5, "z": 15},
            ],
            "duration": 200,
            "config": {"wind_speed": 3, "obstacles": True}
        },
    ]

    result = supabase.table("scenarios").insert(scenarios).execute()
    ids = [s["id"] for s in result.data]
    print(f"  Created {len(ids)} scenarios")
    return ids


def seed_runs(supabase: Client, scenario_ids: list[str]) -> list[dict]:
    """Create sample runs with various statuses."""
    print("Creating runs...")

    now = datetime.utcnow()

    runs = [
        {
            "name": "baseline-v1",
            "status": "completed",
            "config": {
                "model_architecture": "DreamerV3",
                "learning_rate": 0.0001,
                "batch_size": 32,
                "epochs": 100,
                "trajectory_horizon": 10,
                "latent_dim": 256
            },
            "created_at": (now - timedelta(days=7)).isoformat(),
            "updated_at": (now - timedelta(days=6)).isoformat(),
        },
        {
            "name": "improved-encoder-v2",
            "status": "completed",
            "config": {
                "model_architecture": "DreamerV3",
                "learning_rate": 0.0001,
                "batch_size": 64,
                "epochs": 150,
                "trajectory_horizon": 15,
                "latent_dim": 512
            },
            "created_at": (now - timedelta(days=5)).isoformat(),
            "updated_at": (now - timedelta(days=4)).isoformat(),
        },
        {
            "name": "high-lr-experiment",
            "status": "completed",
            "config": {
                "model_architecture": "DreamerV3",
                "learning_rate": 0.001,
                "batch_size": 32,
                "epochs": 100,
                "trajectory_horizon": 10,
                "latent_dim": 256
            },
            "created_at": (now - timedelta(days=3)).isoformat(),
            "updated_at": (now - timedelta(days=2)).isoformat(),
        },
        {
            "name": "long-horizon-test",
            "status": "training",
            "progress": 0.72,
            "current_step": "training",
            "total_steps": 3,
            "started_at": (now - timedelta(hours=2)).isoformat(),
            "eta_seconds": 1800,
            "config": {
                "model_architecture": "DreamerV3",
                "learning_rate": 0.0001,
                "batch_size": 32,
                "epochs": 200,
                "trajectory_horizon": 20,
                "latent_dim": 256
            },
            "created_at": (now - timedelta(hours=3)).isoformat(),
            "updated_at": now.isoformat(),
        },
        {
            "name": "new-architecture-test",
            "status": "pending",
            "config": {
                "model_architecture": "DreamerV3-Large",
                "learning_rate": 0.00005,
                "batch_size": 16,
                "epochs": 100,
                "trajectory_horizon": 10,
                "latent_dim": 1024
            },
            "created_at": (now - timedelta(hours=1)).isoformat(),
            "updated_at": (now - timedelta(hours=1)).isoformat(),
        },
    ]

    result = supabase.table("runs").insert(runs).execute()
    print(f"  Created {len(result.data)} runs")
    return result.data


def seed_metrics(supabase: Client, runs: list[dict]):
    """Create sample metrics for completed/training runs."""
    print("Creating metrics...")

    total_metrics = 0

    for run in runs:
        if run["status"] not in ["completed", "training", "evaluating"]:
            continue

        epochs = run["config"].get("epochs", 100)

        # For training runs, only show partial progress
        if run["status"] == "training":
            epochs = int(epochs * run.get("progress", 0.5))

        metrics = []
        base_loss = random.uniform(0.8, 1.2)
        base_mse = random.uniform(0.5, 0.8)

        for epoch in range(1, epochs + 1):
            # Simulate training curve with diminishing returns
            progress = epoch / run["config"].get("epochs", 100)
            noise = random.uniform(-0.02, 0.02)

            # Exponential decay with noise
            loss = base_loss * math.exp(-3 * progress) + 0.02 + noise
            mse = base_mse * math.exp(-2.5 * progress) + 0.015 + noise

            # Ensure positive values
            loss = max(0.01, loss)
            mse = max(0.01, mse)

            metrics.append({
                "run_id": run["id"],
                "epoch": epoch,
                "loss": round(loss, 6),
                "trajectory_mse": round(mse, 6),
            })

        if metrics:
            # Insert in batches to avoid timeout
            batch_size = 50
            for i in range(0, len(metrics), batch_size):
                batch = metrics[i:i + batch_size]
                supabase.table("metrics").insert(batch).execute()
            total_metrics += len(metrics)

    print(f"  Created {total_metrics} metric records")


def seed_models(supabase: Client, runs: list[dict]):
    """Create sample models for completed runs."""
    print("Creating models...")

    models = []
    version = 1

    for run in runs:
        if run["status"] != "completed":
            continue

        # Get best MSE from this run's config to simulate eval score
        base_score = random.uniform(0.02, 0.08)

        models.append({
            "run_id": run["id"],
            "version": version,
            "checkpoint_url": f"https://storage.example.com/models/{run['name']}/best_model.pt",
            "eval_score": round(base_score, 4),
        })
        version += 1

    if models:
        result = supabase.table("models").insert(models).execute()
        print(f"  Created {len(result.data)} models")


def seed_episodes(supabase: Client, runs: list[dict], scenario_ids: list[str]):
    """Create sample episodes for runs."""
    print("Creating episodes...")

    episodes = []

    for run in runs:
        if run["status"] == "pending":
            continue

        # Each run has 2-5 episodes
        num_episodes = random.randint(2, 5)

        for i in range(num_episodes):
            scenario_id = random.choice(scenario_ids)
            frames = random.randint(200, 500)

            episodes.append({
                "run_id": run["id"],
                "scenario_id": scenario_id,
                "data_url": f"./data/ep_{run['name']}_{i}.json",
                "frames": frames,
            })

    if episodes:
        result = supabase.table("episodes").insert(episodes).execute()
        print(f"  Created {len(result.data)} episodes")


def main():
    parser = argparse.ArgumentParser(description="Seed sample data into Supabase")
    parser.add_argument("--clear", action="store_true", help="Clear existing data first")
    args = parser.parse_args()

    print("=" * 50)
    print("Commlink - Seed Data Script")
    print("=" * 50)
    print()

    supabase = get_supabase_client()
    print("Connected to Supabase")
    print()

    if args.clear:
        clear_data(supabase)
        print()

    # Seed in order (respecting foreign keys)
    scenario_ids = seed_scenarios(supabase)
    runs = seed_runs(supabase, scenario_ids)
    seed_metrics(supabase, runs)
    seed_models(supabase, runs)
    seed_episodes(supabase, runs, scenario_ids)

    print()
    print("=" * 50)
    print("Seeding complete!")
    print("Visit your dashboard to see the sample data.")
    print("=" * 50)


if __name__ == "__main__":
    main()
