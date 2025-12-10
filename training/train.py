#!/usr/bin/env python3
"""
Training Script for World Model

Loads episode data, trains the world model, and logs metrics to Supabase.
Designed to run locally with GPU (RTX 5070) or on cloud (RunPod).

Features:
- Progress tracking with ETA
- Real-time updates to Supabase
- Console progress bars
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta
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


def format_time(seconds: float) -> str:
    """Format seconds into human readable string."""
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        mins = seconds // 60
        secs = seconds % 60
        return f"{mins:.0f}m {secs:.0f}s"
    else:
        hours = seconds // 3600
        mins = (seconds % 3600) // 60
        return f"{hours:.0f}h {mins:.0f}m"


def print_progress_bar(
    current: int,
    total: int,
    prefix: str = "",
    suffix: str = "",
    length: int = 40,
    fill: str = "━",
    empty: str = "─",
):
    """Print a progress bar to console."""
    percent = current / total if total > 0 else 0
    filled_length = int(length * percent)
    bar = fill * filled_length + empty * (length - filled_length)
    percent_str = f"{percent * 100:5.1f}%"

    # Clear line and print
    sys.stdout.write(f"\r{prefix} {bar} {percent_str} {suffix}")
    sys.stdout.flush()

    if current >= total:
        print()  # New line when complete


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
    """Handles training loop and metric logging with progress tracking."""

    # Training is step 2 of 3 (collecting=1, training=2, evaluating=3)
    STEP_COLLECTING = "collecting"
    STEP_TRAINING = "training"
    STEP_EVALUATING = "evaluating"

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
        self.start_time: Optional[float] = None
        self.epoch_times: list[float] = []

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

    def update_progress(
        self,
        current_step: str,
        progress: float,
        eta_seconds: Optional[int] = None,
    ):
        """Update run progress in Supabase."""
        if self.supabase and self.run_id:
            update_data = {
                "current_step": current_step,
                "progress": float(progress),
            }
            if eta_seconds is not None:
                update_data["eta_seconds"] = eta_seconds

            self.supabase.table("runs").update(update_data).eq("id", self.run_id).execute()

    def save_checkpoint(self, path: str, epoch: int, optimizer: optim.Optimizer):
        """Save model checkpoint."""
        torch.save({
            "epoch": epoch,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
        }, path)

    def estimate_eta(self, current_epoch: int, total_epochs: int) -> Optional[int]:
        """Estimate time remaining based on epoch times."""
        if len(self.epoch_times) < 2:
            return None

        # Use rolling average of last 5 epochs for stability
        recent_times = self.epoch_times[-5:]
        avg_epoch_time = sum(recent_times) / len(recent_times)

        remaining_epochs = total_epochs - current_epoch
        eta_seconds = int(avg_epoch_time * remaining_epochs)

        return eta_seconds

    def print_status(
        self,
        epoch: int,
        total_epochs: int,
        loss: float,
        mse: float,
        best_mse: float,
        eta_seconds: Optional[int],
    ):
        """Print formatted status to console."""
        progress = epoch / total_epochs

        # Build status line
        elapsed = time.time() - self.start_time if self.start_time else 0
        elapsed_str = format_time(elapsed)

        if eta_seconds:
            eta_str = format_time(eta_seconds)
            completion_time = datetime.now() + timedelta(seconds=eta_seconds)
            completion_str = completion_time.strftime("%I:%M %p")
        else:
            eta_str = "calculating..."
            completion_str = "--:--"

        # Clear previous lines and print status block
        print(f"\n{'─' * 60}")
        print(f"  Epoch {epoch}/{total_epochs}")
        print_progress_bar(epoch, total_epochs, prefix="  ", length=50)
        print(f"\n  Loss: {loss:.6f}  |  MSE: {mse:.6f}  |  Best: {best_mse:.6f}")
        print(f"  Elapsed: {elapsed_str}  |  ETA: {eta_str}  |  Done at: {completion_str}")
        print(f"{'─' * 60}")

    def train(
        self,
        train_loader: DataLoader,
        epochs: int = 100,
        lr: float = 1e-4,
        checkpoint_dir: str = "./checkpoints",
    ):
        """Main training loop with progress tracking."""
        os.makedirs(checkpoint_dir, exist_ok=True)

        optimizer = optim.AdamW(self.model.parameters(), lr=lr)
        scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, epochs)

        # Initialize progress tracking
        self.start_time = time.time()
        self.epoch_times = []

        # Update status to training
        self.update_run_status("training")
        if self.supabase and self.run_id:
            self.supabase.table("runs").update({
                "started_at": datetime.utcnow().isoformat(),
                "current_step": self.STEP_TRAINING,
                "total_steps": 3,
            }).eq("id", self.run_id).execute()

        best_mse = float("inf")

        print(f"\n{'=' * 60}")
        print(f"  TRAINING STARTED")
        print(f"  Epochs: {epochs} | Batches/epoch: {len(train_loader)}")
        print(f"{'=' * 60}\n")

        for epoch in range(epochs):
            epoch_start = time.time()
            self.model.train()
            epoch_loss = 0.0
            epoch_mse = 0.0
            num_batches = len(train_loader)

            # Batch progress
            for batch_idx, (states, actions, targets) in enumerate(train_loader):
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

                # Print batch progress (overwrite line)
                batch_progress = (batch_idx + 1) / num_batches
                sys.stdout.write(f"\r  Epoch {epoch + 1}/{epochs} - Batch {batch_idx + 1}/{num_batches} ({batch_progress * 100:.0f}%)")
                sys.stdout.flush()

            scheduler.step()

            # Track epoch time
            epoch_time = time.time() - epoch_start
            self.epoch_times.append(epoch_time)

            # Average metrics
            avg_loss = epoch_loss / max(num_batches, 1)
            avg_mse = epoch_mse / max(num_batches, 1)

            # Calculate progress and ETA
            progress = (epoch + 1) / epochs
            eta_seconds = self.estimate_eta(epoch + 1, epochs)

            # Update Supabase progress
            self.update_progress(self.STEP_TRAINING, progress, eta_seconds)

            # Log metrics to Supabase
            self.log_metrics(epoch + 1, avg_loss, avg_mse)

            # Save best checkpoint
            is_best = avg_mse < best_mse
            if is_best:
                best_mse = avg_mse
                checkpoint_path = os.path.join(checkpoint_dir, "best_model.pt")
                self.save_checkpoint(checkpoint_path, epoch, optimizer)

            # Print status
            self.print_status(epoch + 1, epochs, avg_loss, avg_mse, best_mse, eta_seconds)

            if is_best:
                print(f"  ** New best model saved! **\n")

            # Regular checkpoint every 10 epochs
            if (epoch + 1) % 10 == 0:
                checkpoint_path = os.path.join(checkpoint_dir, f"checkpoint_epoch_{epoch + 1}.pt")
                self.save_checkpoint(checkpoint_path, epoch, optimizer)

        # Training complete
        total_time = time.time() - self.start_time
        print(f"\n{'=' * 60}")
        print(f"  TRAINING COMPLETE")
        print(f"  Total time: {format_time(total_time)}")
        print(f"  Best MSE: {best_mse:.6f}")
        print(f"{'=' * 60}\n")

        self.update_run_status("evaluating")
        self.update_progress(self.STEP_EVALUATING, 1.0, 0)

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
