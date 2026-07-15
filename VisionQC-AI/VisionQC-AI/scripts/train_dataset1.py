from __future__ import annotations

import argparse
import os
import json
from copy import deepcopy
from pathlib import Path

import torch
from torch import nn
from torch.optim import Adam
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, models, transforms


IMAGE_SIZE = 224
DEFAULT_BATCH_SIZE = 32
DEFAULT_EPOCHS = 12
DEFAULT_LEARNING_RATE = 3e-4
DEFAULT_NUM_WORKERS = 0
DEFAULT_WEIGHT_DECAY = 1e-4
DEFAULT_LABEL_SMOOTHING = 0.1
DEFAULT_PATIENCE = 4
DEFAULT_MIN_DELTA = 1e-3
DEFAULT_TORCH_CACHE_DIR = Path("models/.torch-cache")


def resolve_dataset_root(dataset_root: Path | None) -> Path:
    if dataset_root:
        root = dataset_root.expanduser().resolve()
        if not (root / "train").exists():
            raise FileNotFoundError(f"Expected a train folder inside {root}")
        return root

    candidates = [
        Path("data/raw/dataset1/New Plant Diseases Dataset(Augmented)/New Plant Diseases Dataset(Augmented)"),
        Path("data/raw/dataset1/New Plant Diseases Dataset(Augmented)"),
        Path("data/raw/dataset1"),
    ]

    for candidate in candidates:
        if (candidate / "train").exists() and (
            (candidate / "valid").exists() or (candidate / "validation").exists()
        ):
            return candidate.resolve()

    raise FileNotFoundError("Could not auto-detect dataset1 root with train/valid folders.")


def resolve_split_paths(dataset_root: Path) -> tuple[Path, Path]:
    train_dir = dataset_root / "train"
    valid_dir = dataset_root / "valid"
    if not valid_dir.exists():
        valid_dir = dataset_root / "validation"

    if not train_dir.exists() or not valid_dir.exists():
        raise FileNotFoundError(
            f"Dataset root {dataset_root} must contain train/valid or train/validation folders."
        )

    return train_dir, valid_dir


def build_transforms() -> tuple[transforms.Compose, transforms.Compose]:
    train_transform = transforms.Compose(
        [
            transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.8, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    eval_transform = transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    return train_transform, eval_transform


def build_loaders(
    train_dir: Path,
    valid_dir: Path,
    batch_size: int,
    num_workers: int,
    max_train_samples: int | None,
    max_valid_samples: int | None,
) -> tuple[DataLoader, DataLoader, list[str]]:
    train_transform, eval_transform = build_transforms()

    train_dataset = datasets.ImageFolder(train_dir, transform=train_transform)
    valid_dataset = datasets.ImageFolder(valid_dir, transform=eval_transform)

    if train_dataset.classes != valid_dataset.classes:
        raise ValueError("Train and validation class lists do not match.")

    if max_train_samples is not None:
        train_dataset = Subset(
            train_dataset,
            range(min(max_train_samples, len(train_dataset))),
        )
    if max_valid_samples is not None:
        valid_dataset = Subset(
            valid_dataset,
            range(min(max_valid_samples, len(valid_dataset))),
        )

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    valid_loader = DataLoader(
        valid_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    classes = (
        train_dataset.dataset.classes
        if isinstance(train_dataset, Subset)
        else train_dataset.classes
    )
    return train_loader, valid_loader, classes


def build_model(num_classes: int, pretrained: bool, freeze_backbone: bool) -> nn.Module:
    weights = models.ResNet18_Weights.DEFAULT if pretrained else None
    model = models.resnet18(weights=weights)
    if freeze_backbone:
        set_backbone_trainable(model, trainable=False)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def set_backbone_trainable(model: nn.Module, trainable: bool) -> None:
    for name, parameter in model.named_parameters():
        if not name.startswith("fc."):
            parameter.requires_grad = trainable


def make_optimizer(model: nn.Module, learning_rate: float, weight_decay: float) -> Adam:
    trainable_params = [parameter for parameter in model.parameters() if parameter.requires_grad]
    return Adam(trainable_params, lr=learning_rate, weight_decay=weight_decay)


def run_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer | None,
    device: torch.device,
    use_amp: bool,
) -> tuple[float, float]:
    is_training = optimizer is not None
    model.train(is_training)
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    total_loss = 0.0
    total_correct = 0
    total_samples = 0

    for images, labels in loader:
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        if is_training:
            optimizer.zero_grad()

        with torch.set_grad_enabled(is_training):
            with torch.amp.autocast("cuda", enabled=use_amp):
                outputs = model(images)
                loss = criterion(outputs, labels)
            if is_training:
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()

        total_loss += loss.item() * labels.size(0)
        total_correct += (outputs.argmax(dim=1) == labels).sum().item()
        total_samples += labels.size(0)

    average_loss = total_loss / max(total_samples, 1)
    accuracy = total_correct / max(total_samples, 1)
    return average_loss, accuracy


def save_outputs(
    model: nn.Module,
    classes: list[str],
    output_dir: Path,
    metadata: dict,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = output_dir / "dataset1_resnet18_best.pt"
    labels_path = output_dir / "dataset1_labels.json"
    metrics_path = output_dir / "dataset1_training_metrics.json"

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "classes": classes,
            "architecture": "resnet18",
            "image_size": IMAGE_SIZE,
        },
        checkpoint_path,
    )
    labels_path.write_text(json.dumps(classes, indent=2), encoding="utf-8")
    metrics_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def save_progress(
    model: nn.Module,
    classes: list[str],
    output_dir: Path,
    metadata: dict,
    epoch: int,
    is_best: bool,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    latest_checkpoint_path = output_dir / "dataset1_resnet18_latest.pt"
    progress_path = output_dir / "dataset1_training_progress.json"
    labels_path = output_dir / "dataset1_labels.json"

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "classes": classes,
            "architecture": "resnet18",
            "image_size": IMAGE_SIZE,
            "epoch": epoch,
        },
        latest_checkpoint_path,
    )
    labels_path.write_text(json.dumps(classes, indent=2), encoding="utf-8")
    progress_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    if is_best:
        best_checkpoint_path = output_dir / "dataset1_resnet18_best.pt"
        torch.save(
            {
                "model_state_dict": model.state_dict(),
                "classes": classes,
                "architecture": "resnet18",
                "image_size": IMAGE_SIZE,
                "epoch": epoch,
            },
            best_checkpoint_path,
        )


def count_trainable_parameters(model: nn.Module) -> int:
    return sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad)


def ensure_torch_cache_dir(cache_dir: Path) -> Path:
    resolved_dir = cache_dir.resolve()
    resolved_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("TORCH_HOME", str(resolved_dir))
    return resolved_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a plant disease classifier on dataset1.")
    parser.add_argument("--dataset-root", type=Path, default=None, help="Path containing train/valid.")
    parser.add_argument("--output-dir", type=Path, default=Path("models"), help="Where to save artifacts.")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--learning-rate", type=float, default=DEFAULT_LEARNING_RATE)
    parser.add_argument("--num-workers", type=int, default=DEFAULT_NUM_WORKERS)
    parser.add_argument(
        "--torch-cache-dir",
        type=Path,
        default=DEFAULT_TORCH_CACHE_DIR,
        help="Directory for pretrained weight downloads.",
    )
    parser.add_argument("--weight-decay", type=float, default=DEFAULT_WEIGHT_DECAY)
    parser.add_argument("--label-smoothing", type=float, default=DEFAULT_LABEL_SMOOTHING)
    parser.add_argument("--patience", type=int, default=DEFAULT_PATIENCE)
    parser.add_argument("--min-delta", type=float, default=DEFAULT_MIN_DELTA)
    parser.add_argument(
        "--freeze-backbone-epochs",
        type=int,
        default=2,
        help="Train only the classifier head for the first N epochs, then fine-tune the full model.",
    )
    parser.add_argument("--max-train-samples", type=int, default=None)
    parser.add_argument("--max-valid-samples", type=int, default=None)
    parser.add_argument(
        "--pretrained",
        dest="pretrained",
        action="store_true",
        help="Use ImageNet pretrained weights.",
    )
    parser.add_argument(
        "--no-pretrained",
        dest="pretrained",
        action="store_false",
        help="Disable ImageNet pretrained weights.",
    )
    parser.set_defaults(pretrained=True)
    parser.add_argument(
        "--freeze-backbone",
        action="store_true",
        help="Keep the backbone frozen for the entire run.",
    )
    args = parser.parse_args()
    torch_cache_dir = ensure_torch_cache_dir(args.torch_cache_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    dataset_root = resolve_dataset_root(args.dataset_root)
    train_dir, valid_dir = resolve_split_paths(dataset_root)

    train_loader, valid_loader, classes = build_loaders(
        train_dir=train_dir,
        valid_dir=valid_dir,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        max_train_samples=args.max_train_samples,
        max_valid_samples=args.max_valid_samples,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    start_with_frozen_backbone = args.freeze_backbone or args.freeze_backbone_epochs > 0
    model = build_model(
        num_classes=len(classes),
        pretrained=args.pretrained,
        freeze_backbone=start_with_frozen_backbone,
    ).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=args.label_smoothing)
    optimizer = make_optimizer(model, args.learning_rate, args.weight_decay)
    scheduler = ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=1)
    use_amp = device.type == "cuda"

    best_state = deepcopy(model.state_dict())
    best_val_accuracy = 0.0
    history: list[dict] = []
    epochs_without_improvement = 0

    print(f"Dataset root: {dataset_root}")
    print(f"Train images: {len(train_loader.dataset)}")
    print(f"Validation images: {len(valid_loader.dataset)}")
    print(f"Classes: {len(classes)}")
    print(f"Device: {device}")
    print(f"AMP enabled: {use_amp}")
    print(f"Torch cache dir: {torch_cache_dir}")

    for epoch in range(1, args.epochs + 1):
        if (
            start_with_frozen_backbone
            and not args.freeze_backbone
            and epoch == args.freeze_backbone_epochs + 1
        ):
            set_backbone_trainable(model, trainable=True)
            optimizer = make_optimizer(model, args.learning_rate * 0.5, args.weight_decay)
            scheduler = ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=1)
            print(
                "Unfroze backbone for full fine-tuning. "
                f"Trainable parameters: {count_trainable_parameters(model):,}"
            )

        train_loss, train_accuracy = run_epoch(
            model, train_loader, criterion, optimizer, device, use_amp
        )
        val_loss, val_accuracy = run_epoch(
            model, valid_loader, criterion, None, device, use_amp
        )
        scheduler.step(val_accuracy)

        history.append(
            {
                "epoch": epoch,
                "train_loss": train_loss,
                "train_accuracy": train_accuracy,
                "val_loss": val_loss,
                "val_accuracy": val_accuracy,
                "learning_rate": optimizer.param_groups[0]["lr"],
            }
        )

        print(
            f"Epoch {epoch}/{args.epochs} | "
            f"train_loss={train_loss:.4f} train_acc={train_accuracy:.4f} | "
            f"val_loss={val_loss:.4f} val_acc={val_accuracy:.4f} | "
            f"lr={optimizer.param_groups[0]['lr']:.6f}"
        )

        if val_accuracy > best_val_accuracy + args.min_delta:
            best_val_accuracy = val_accuracy
            best_state = deepcopy(model.state_dict())
            epochs_without_improvement = 0
            is_best = True
        else:
            epochs_without_improvement += 1
            is_best = False

        progress_metadata = {
            "dataset_root": str(dataset_root),
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "learning_rate": args.learning_rate,
            "weight_decay": args.weight_decay,
            "label_smoothing": args.label_smoothing,
            "pretrained": args.pretrained,
            "freeze_backbone": args.freeze_backbone,
            "freeze_backbone_epochs": args.freeze_backbone_epochs,
            "patience": args.patience,
            "min_delta": args.min_delta,
            "max_train_samples": args.max_train_samples,
            "max_valid_samples": args.max_valid_samples,
            "best_val_accuracy": best_val_accuracy,
            "device": str(device),
            "amp_enabled": use_amp,
            "torch_cache_dir": str(torch_cache_dir),
            "completed_epochs": epoch,
            "stopped_early": False,
            "history": history,
        }
        save_progress(
            model=model,
            classes=classes,
            output_dir=args.output_dir,
            metadata=progress_metadata,
            epoch=epoch,
            is_best=is_best,
        )

        if epochs_without_improvement >= args.patience:
            print(
                f"Early stopping triggered after epoch {epoch}. "
                f"No validation accuracy improvement greater than {args.min_delta} "
                f"for {args.patience} epoch(s)."
            )
            break

    model.load_state_dict(best_state)
    metadata = {
        "dataset_root": str(dataset_root),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "weight_decay": args.weight_decay,
        "label_smoothing": args.label_smoothing,
        "pretrained": args.pretrained,
        "freeze_backbone": args.freeze_backbone,
        "freeze_backbone_epochs": args.freeze_backbone_epochs,
        "patience": args.patience,
        "min_delta": args.min_delta,
        "max_train_samples": args.max_train_samples,
        "max_valid_samples": args.max_valid_samples,
        "best_val_accuracy": best_val_accuracy,
        "device": str(device),
        "amp_enabled": use_amp,
        "torch_cache_dir": str(torch_cache_dir),
        "completed_epochs": len(history),
        "stopped_early": epochs_without_improvement >= args.patience,
        "history": history,
    }
    save_outputs(model, classes, args.output_dir, metadata)

    print(f"Best validation accuracy: {best_val_accuracy:.4f}")
    print(f"Saved checkpoint to: {(args.output_dir / 'dataset1_resnet18_best.pt').resolve()}")


if __name__ == "__main__":
    main()
