#!/usr/bin/env python3
"""
World Model for Drone Trajectory Prediction

A DreamerV3-inspired latent dynamics model that learns to predict
future drone trajectories from current state and actions.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple


class StateEncoder(nn.Module):
    """Encodes drone state (position, velocity, orientation) into latent space."""

    def __init__(self, state_dim: int = 12, latent_dim: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, 128),
            nn.LayerNorm(128),
            nn.SiLU(),
            nn.Linear(128, 256),
            nn.LayerNorm(256),
            nn.SiLU(),
            nn.Linear(256, latent_dim),
        )

    def forward(self, state: torch.Tensor) -> torch.Tensor:
        """
        Args:
            state: [batch, state_dim] - position(3) + velocity(3) + orientation(3) + angular_vel(3)
        Returns:
            latent: [batch, latent_dim]
        """
        return self.net(state)


class ImageEncoder(nn.Module):
    """Encodes camera images into latent space using CNN."""

    def __init__(self, latent_dim: int = 256):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(3, 32, 4, stride=2, padding=1),  # 64x64 -> 32x32
            nn.SiLU(),
            nn.Conv2d(32, 64, 4, stride=2, padding=1),  # 32x32 -> 16x16
            nn.SiLU(),
            nn.Conv2d(64, 128, 4, stride=2, padding=1),  # 16x16 -> 8x8
            nn.SiLU(),
            nn.Conv2d(128, 256, 4, stride=2, padding=1),  # 8x8 -> 4x4
            nn.SiLU(),
            nn.Flatten(),
        )
        self.fc = nn.Linear(256 * 4 * 4, latent_dim)

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        """
        Args:
            image: [batch, 3, 64, 64] - RGB image normalized to [0, 1]
        Returns:
            latent: [batch, latent_dim]
        """
        x = self.conv(image)
        return self.fc(x)


class ActionEncoder(nn.Module):
    """Encodes action into latent space."""

    def __init__(self, action_dim: int = 4, latent_dim: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(action_dim, 32),
            nn.SiLU(),
            nn.Linear(32, latent_dim),
        )

    def forward(self, action: torch.Tensor) -> torch.Tensor:
        """
        Args:
            action: [batch, action_dim] - throttle, roll, pitch, yaw
        Returns:
            latent: [batch, latent_dim]
        """
        return self.net(action)


class DynamicsModel(nn.Module):
    """
    Recurrent dynamics model that predicts next latent state.
    Uses GRU for temporal modeling.
    """

    def __init__(self, latent_dim: int = 256, action_latent_dim: int = 64, hidden_dim: int = 512):
        super().__init__()
        self.hidden_dim = hidden_dim

        # Combine state latent and action latent
        self.input_proj = nn.Linear(latent_dim + action_latent_dim, hidden_dim)

        # GRU for temporal dynamics
        self.gru = nn.GRU(hidden_dim, hidden_dim, batch_first=True)

        # Output projection
        self.output_proj = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, latent_dim),
        )

    def forward(
        self,
        state_latent: torch.Tensor,
        action_latent: torch.Tensor,
        hidden: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            state_latent: [batch, latent_dim]
            action_latent: [batch, action_latent_dim]
            hidden: [1, batch, hidden_dim] - GRU hidden state
        Returns:
            next_latent: [batch, latent_dim]
            next_hidden: [1, batch, hidden_dim]
        """
        # Combine inputs
        x = torch.cat([state_latent, action_latent], dim=-1)
        x = self.input_proj(x)
        x = x.unsqueeze(1)  # [batch, 1, hidden_dim]

        # Initialize hidden state if needed
        if hidden is None:
            hidden = torch.zeros(1, x.size(0), self.hidden_dim, device=x.device)

        # GRU forward
        out, hidden = self.gru(x, hidden)
        out = out.squeeze(1)  # [batch, hidden_dim]

        # Project to latent space
        next_latent = self.output_proj(out)

        return next_latent, hidden


class TrajectoryDecoder(nn.Module):
    """Decodes latent state to predicted position."""

    def __init__(self, latent_dim: int = 256, output_dim: int = 3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim, 128),
            nn.SiLU(),
            nn.Linear(128, 64),
            nn.SiLU(),
            nn.Linear(64, output_dim),
        )

    def forward(self, latent: torch.Tensor) -> torch.Tensor:
        """
        Args:
            latent: [batch, latent_dim]
        Returns:
            position: [batch, 3] - predicted x, y, z
        """
        return self.net(latent)


class WorldModel(nn.Module):
    """
    Complete world model for drone trajectory prediction.

    Architecture:
        Input -> StateEncoder + ImageEncoder -> Combined Latent
        Combined Latent + ActionEncoder -> DynamicsModel -> Next Latent
        Next Latent -> TrajectoryDecoder -> Predicted Position
    """

    def __init__(
        self,
        state_dim: int = 12,
        action_dim: int = 4,
        latent_dim: int = 256,
        use_images: bool = False,
    ):
        super().__init__()
        self.use_images = use_images
        self.latent_dim = latent_dim

        # Encoders
        self.state_encoder = StateEncoder(state_dim, latent_dim)
        self.action_encoder = ActionEncoder(action_dim, 64)

        if use_images:
            self.image_encoder = ImageEncoder(latent_dim)
            self.latent_fusion = nn.Linear(latent_dim * 2, latent_dim)

        # Dynamics model
        self.dynamics = DynamicsModel(latent_dim, 64, 512)

        # Decoder
        self.trajectory_decoder = TrajectoryDecoder(latent_dim, 3)

    def encode_state(
        self,
        state: torch.Tensor,
        image: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """Encode state (and optionally image) into latent space."""
        state_latent = self.state_encoder(state)

        if self.use_images and image is not None:
            image_latent = self.image_encoder(image)
            combined = torch.cat([state_latent, image_latent], dim=-1)
            return self.latent_fusion(combined)

        return state_latent

    def predict_trajectory(
        self,
        state: torch.Tensor,
        actions: torch.Tensor,
        image: Optional[torch.Tensor] = None,
        horizon: int = 10
    ) -> torch.Tensor:
        """
        Predict future trajectory given current state and sequence of actions.

        Args:
            state: [batch, state_dim] - current state
            actions: [batch, horizon, action_dim] - sequence of future actions
            image: [batch, 3, 64, 64] - optional current image
            horizon: number of steps to predict

        Returns:
            trajectory: [batch, horizon, 3] - predicted positions
        """
        batch_size = state.size(0)
        device = state.device

        # Encode initial state
        latent = self.encode_state(state, image)
        hidden = None

        # Predict trajectory
        predictions = []
        for t in range(horizon):
            action = actions[:, t] if actions.size(1) > t else actions[:, -1]
            action_latent = self.action_encoder(action)

            # Predict next latent state
            latent, hidden = self.dynamics(latent, action_latent, hidden)

            # Decode to position
            position = self.trajectory_decoder(latent)
            predictions.append(position)

        return torch.stack(predictions, dim=1)

    def forward(
        self,
        states: torch.Tensor,
        actions: torch.Tensor,
        images: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        Forward pass for training.

        Args:
            states: [batch, seq_len, state_dim]
            actions: [batch, seq_len, action_dim]
            images: [batch, seq_len, 3, 64, 64] (optional)

        Returns:
            predicted_positions: [batch, seq_len-1, 3]
        """
        batch_size, seq_len, _ = states.shape
        device = states.device

        # Process sequence
        predictions = []
        hidden = None

        for t in range(seq_len - 1):
            state = states[:, t]
            action = actions[:, t]
            image = images[:, t] if images is not None else None

            # Encode
            latent = self.encode_state(state, image)
            action_latent = self.action_encoder(action)

            # Dynamics
            next_latent, hidden = self.dynamics(latent, action_latent, hidden)

            # Decode
            pred_pos = self.trajectory_decoder(next_latent)
            predictions.append(pred_pos)

        return torch.stack(predictions, dim=1)


def compute_trajectory_mse(
    predictions: torch.Tensor,
    targets: torch.Tensor
) -> torch.Tensor:
    """
    Compute MSE between predicted and actual trajectories.

    Args:
        predictions: [batch, horizon, 3]
        targets: [batch, horizon, 3]

    Returns:
        mse: scalar tensor
    """
    return F.mse_loss(predictions, targets)


# Test the model
if __name__ == "__main__":
    # Create model
    model = WorldModel(state_dim=12, action_dim=4, latent_dim=256, use_images=False)

    # Test data
    batch_size = 8
    seq_len = 20
    states = torch.randn(batch_size, seq_len, 12)
    actions = torch.randn(batch_size, seq_len, 4)

    # Forward pass
    predictions = model(states, actions)
    print(f"Predictions shape: {predictions.shape}")  # [8, 19, 3]

    # Test trajectory prediction
    current_state = torch.randn(batch_size, 12)
    future_actions = torch.randn(batch_size, 10, 4)
    trajectory = model.predict_trajectory(current_state, future_actions, horizon=10)
    print(f"Trajectory shape: {trajectory.shape}")  # [8, 10, 3]

    # Compute loss
    target_positions = states[:, 1:, :3]  # Use actual positions as targets
    loss = compute_trajectory_mse(predictions, target_positions)
    print(f"Loss: {loss.item():.4f}")

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
