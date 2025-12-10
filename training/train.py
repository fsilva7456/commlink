#!/usr/bin/env python3
"""
Training Script for World Model

Loads episode data, trains the world model, and logs metrics to Supabase.
Designed to run locally with GPU (RTX 5070) or on cloud (RunPod).
"""

import argparse
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

from model import WorldModel, compute_trajectory_mse

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None


class EpisodeDataset(Dataset):
    """Dataset for loading episode data."""

    def __init__(self, data_dir: str, seq_len: int = 20):
        self.data_dir = Path(data_dir)
        self.seq_len = seq_len
        self.episodes = []

        # Load all episodes
        for ep_file in self.data_dir.glob("*.json"):
            if "_images" not in ep_file.name:
                with open(ep_file) as f:
                    episode = json.load(f)
                    if len(episode.get("frames", [])) >= seq_len:
                        self.episodes.append(episode)

        print(f"Loaded {len(self.episodes)} episodes")

    def __len__(self):
        return len(self.episodes) * 10  # Multiple sequences per episode

    def __getitem__(self, idx):
        # Select episode
        ep_idx = idx % len(self.episodes)
        episode = self.episodes[ep_idx]
        frames = episode["frames"]

        # Random starting point
        max_start = len(frames) - self.seq_len
        start_idx = np.random.randint(0, max(1, max_start + 1))

        # Extract sequences
        states = []
        actions = []

        for i in range(start_idx, start_idx + self.seq_len):
            frame = frames[min(i, len(frames) - 1)]

            # State: position(3) + velocity(3) + orientation(3) + angular_vel(3)
            state = frame["state"]
            state_vec = (
                state["position"] +
                state["velocity"] +
                state["orientation"] +
                state["angular_velocity"]
            )
            states.append(state_vec)

            # Action: throttle, roll, pitch, yaw
            action = frame["action"]
            action_vec = [
                action["throttle"],
                action["roll"],
                action["pitch"],
                action["yaw"]
            ]
            actions.append(action_vec)

        states = torch.tensor(states, dtype=torch.float32)
        actions = torch.tensor(actions, dtype=torch.float32)

        # Target: next positions
        targets = states[1:, :3]  # position only

        return states, actions, targets


class DummyDataset(Dataset):
    """Dummy dataset for testing without real data."""

    def __init__(self, num_samples: int = 1000, seq_len: int = 20):
        self.num_samples = num_samples
        self.seq_len = seq_len

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        # Generate synthetic trajectory
        t = torch.linspace(0, 2 * np.pi, self.seq_len)

        # Circular motion with some noise
        x = torch.cos(t) * 10 + torch.randn(self.seq_len) * 0.1
        y = torch.sin(t) * 10 + torch.randn(self.seq_len) * 0.1
        z = torch.ones(self.seq_len) * 10 + torch.randn(self.seq_len) * 0.1

        # Velocities (derivatives)
        vx = -torch.sin(t) * 10
        vy = torch.cos(t) * 10
        vz = torch.zeros(self.seq_len)

        # Orientation (heading direction)
        yaw = t
        roll = torch.zeros(self.seq_len)
        pitch = torch.zeros(self.seq_len)

        # Angular velocity
        wx = torch.zeros(self.seq_len)
        wy = torch.zeros(self.seq_len)
        wz = torch.ones(self.seq_len)  # constant yaw rate

        # Combine into state
        states = torch.stack([x, y, z, vx, vy, vz, roll, pitch, yaw, wx, wy, wz], dim=1)

        # Actions (constant for circular motion)
        actions = torch.zeros(self.seq_len, 4)
        actions[:, 0] = 0.5  # throttle
        actions[:, 3] = 0.1  # yaw rate

        # Targets
        targets = states[1:, :3]

        return states, actions, targets


class Trainer:
    """Handles training loop and metric logging."""

    def __init__(
        self,
        model: WorldModel,
        device: torch.device,
        run_id: Optional[str] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
    ):
        self.model = model.to(device)
        self.device = device
        self.run_id = run_id

        # Supabase client
        self.supabase: Optional[Client] = None
        if supabase_url and supabase_key and create_client:
            self.supabase = create_client(supabase_url, supabase_key)

    def log_metrics(self, epoch: int, loss: float, trajectory_mse: float):
        """Log metrics to Supabase."""
        if self.supabase and self.run_id:
            self.supabase.table("metrics").insert({
                "run_id": self.run_id,
                "epoch": epoch,
                "loss": float(loss),
                "trajectory_mse": float(trajectory_mse),
            }).execute()

    def update_run_status(self, status: str):
        """Update run status in Supabase."""
        if self.supabase and self.run_id:
            self.supabase.table("runs").update({
                "status": status
            }).eq("id", self.run_id).execute()

    def save_checkpoint(self, path: str, epoch: int, optimizer: optim.Optimizer):
        """Save model checkpoint."""
        torch.save({
            "epoch": epoch,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
        }, path)

    def train(
        self,
        train_loader: DataLoader,
        epochs: int = 100,
        lr: float = 1e-4,
        checkpoint_dir: str = "./checkpoints",
    ):
        """Main training loop."""
        os.makedirs(checkpoint_dir, exist_ok=True)

        optimizer = optim.AdamW(self.model.parameters(), lr=lr)
        scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, epochs)

        self.update_run_status("training")
        best_mse = float("inf")

        for epoch in range(epochs):
            self.model.train()
            epoch_loss = 0.0
            epoch_mse = 0.0
            num_batches = 0

            for states, actions, targets in train_loader:
                states = states.to(self.device)
                actions = actions.to(self.device)
                targets = targets.to(self.device)

                # Forward pass
                predictions = self.model(states, actions)

                # Compute loss
                loss = compute_trajectory_mse(predictions, targets)

                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()

                epoch_loss += loss.item()
                epoch_mse += loss.item()
                num_batches += 1

            scheduler.step()

            # Average metrics
            avg_loss = epoch_loss / max(num_batches, 1)
            avg_mse = epoch_mse / max(num_batches, 1)

            # Log to console
            print(f"Epoch {epoch + 1}/{epochs} | Loss: {avg_loss:.6f} | MSE: {avg_mse:.6f}")

            # Log to Supabase
            self.log_metrics(epoch + 1, avg_loss, avg_mse)

            # Save best checkpoint
            if avg_mse < best_mse:
                best_mse = avg_mse
                checkpoint_path = os.path.join(checkpoint_dir, "best_model.pt")
                self.save_checkpoint(checkpoint_path, epoch, optimizer)
                print(f"  -> New best model saved (MSE: {best_mse:.6f})")

            # Regular checkpoint every 10 epochs
            if (epoch + 1) % 10 == 0:
                checkpoint_path = os.path.join(checkpoint_dir, f"checkpoint_epoch_{epoch + 1}.pt")
                self.save_checkpoint(checkpoint_path, epoch, optimizer)

        self.update_run_status("evaluating")
        return best_mse


def main():
    parser = argparse.ArgumentParser(description="Train World Model")
    parser.add_argument("--data-dir", type=str, default="./data", help="Directory with episode data")
    parser.add_argument("--epochs", type=int, default=100, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--seq-len", type=int, default=20, help="Sequence length")
    parser.add_argument("--latent-dim", type=int, default=256, help="Latent dimension")
    parser.add_argument("--checkpoint-dir", type=str, default="./checkpoints", help="Checkpoint directory")
    parser.add_argument("--run-id", type=str, default=None, help="Supabase run ID")
    parser.add_argument("--use-dummy-data", action="store_true", help="Use dummy data for testing")
    args = parser.parse_args()

    # Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name()}")

    # Dataset
    if args.use_dummy_data:
        print("Using dummy dataset for testing")
        dataset = DummyDataset(num_samples=1000, seq_len=args.seq_len)
    else:
        dataset = EpisodeDataset(args.data_dir, seq_len=args.seq_len)

    train_loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=4,
        pin_memory=True,
    )

    # Model
    model = WorldModel(
        state_dim=12,
        action_dim=4,
        latent_dim=args.latent_dim,
        use_images=False,
    )

    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")

    # Trainer
    trainer = Trainer(
        model=model,
        device=device,
        run_id=args.run_id or os.getenv("RUN_ID"),
        supabase_url=os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        supabase_key=os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    )

    # Train
    print(f"\nStarting training for {args.epochs} epochs...")
    best_mse = trainer.train(
        train_loader,
        epochs=args.epochs,
        lr=args.lr,
        checkpoint_dir=args.checkpoint_dir,
    )

    print(f"\nTraining complete! Best MSE: {best_mse:.6f}")


if __name__ == "__main__":
    main()
