from __future__ import annotations

import argparse
import json
import os
import random
from copy import deepcopy
from pathlib import Path

import torch
from PIL import Image
from torch import nn
from torch.optim import Adam
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import ConcatDataset, DataLoader, Dataset, WeightedRandomSampler
from torchvision import datasets, models, transforms


IMAGE_SIZE = 224
DEFAULT_BATCH_SIZE = 8
DEFAULT_EPOCHS = 12
DEFAULT_LEARNING_RATE = 3e-4
DEFAULT_NUM_WORKERS = 0
DEFAULT_WEIGHT_DECAY = 1e-4
DEFAULT_LABEL_SMOOTHING = 0.1
DEFAULT_PATIENCE = 4
DEFAULT_MIN_DELTA = 1e-3
DEFAULT_VALID_SPLIT = 0.2
DEFAULT_SEED = 42
DEFAULT_FREEZE_BACKBONE_EPOCHS = 2
DEFAULT_TORCH_CACHE_DIR = Path("models/.torch-cache")
DEFAULT_BALANCE_POWER = 0.5
DEFAULT_MAX_DATASET1_SAMPLES_PER_CLASS = 200
DEFAULT_ARCHITECTURE = "resnet18"

DATASET1_TO_DATASET2_LABEL_MAP = {
    "Apple___Apple_scab": "Apple Scab Leaf",
    "Apple___Cedar_apple_rust": "Apple rust leaf",
    "Apple___healthy": "Apple leaf",
    "Blueberry___healthy": "Blueberry leaf",
    "Cherry_(including_sour)___healthy": "Cherry leaf",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Corn Gray leaf spot",
    "Corn_(maize)___Common_rust_": "Corn rust leaf",
    "Corn_(maize)___Northern_Leaf_Blight": "Corn leaf blight",
    "Grape___Black_rot": "grape leaf black rot",
    "Grape___healthy": "grape leaf",
    "Peach___healthy": "Peach leaf",
    "Pepper,_bell___Bacterial_spot": "Bell_pepper leaf spot",
    "Pepper,_bell___healthy": "Bell_pepper leaf",
    "Potato___Early_blight": "Potato leaf early blight",
    "Potato___Late_blight": "Potato leaf late blight",
    "Raspberry___healthy": "Raspberry leaf",
    "Soybean___healthy": "Soyabean leaf",
    "Squash___Powdery_mildew": "Squash Powdery mildew leaf",
    "Strawberry___healthy": "Strawberry leaf",
    "Tomato___Bacterial_spot": "Tomato leaf bacterial spot",
    "Tomato___Early_blight": "Tomato Early blight leaf",
    "Tomato___Late_blight": "Tomato leaf late blight",
    "Tomato___Leaf_Mold": "Tomato mold leaf",
    "Tomato___Septoria_leaf_spot": "Tomato Septoria leaf spot",
    "Tomato___Spider_mites Two-spotted_spider_mite": "Tomato two spotted spider mites leaf",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Tomato leaf yellow virus",
    "Tomato___Tomato_mosaic_virus": "Tomato leaf mosaic virus",
    "Tomato___healthy": "Tomato leaf",
}


class TransformedSubset(Dataset):
    def __init__(self, image_folder: datasets.ImageFolder, indices: list[int], transform) -> None:
        self.image_folder = image_folder
        self.indices = indices
        self.transform = transform
        self.classes = image_folder.classes
        self.class_to_idx = image_folder.class_to_idx
        self.targets = [image_folder.targets[index] for index in indices]

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, item: int) -> tuple[torch.Tensor, int]:
        sample_index = self.indices[item]
        image_path, label = self.image_folder.samples[sample_index]
        sample = pil_loader_with_long_path_support(image_path)
        if self.transform is not None:
            sample = self.transform(sample)
        return sample, label


class PathLabelDataset(Dataset):
    def __init__(self, samples: list[tuple[str, int]], classes: list[str], transform) -> None:
        self.samples = samples
        self.classes = classes
        self.targets = [label for _, label in samples]
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, item: int) -> tuple[torch.Tensor, int]:
        image_path, label = self.samples[item]
        sample = pil_loader_with_long_path_support(image_path)
        if self.transform is not None:
            sample = self.transform(sample)
        return sample, label


def pil_loader_with_long_path_support(path: str) -> Image.Image:
    resolved_path = str(Path(path).resolve())
    if os.name == "nt" and not resolved_path.startswith("\\\\?\\") and len(resolved_path) >= 240:
        resolved_path = "\\\\?\\" + resolved_path
    with open(resolved_path, "rb") as file_handle:
        image = Image.open(file_handle)
        return image.convert("RGB")


def resolve_dataset_root(dataset_root: Path | None) -> Path:
    if dataset_root:
        root = dataset_root.expanduser().resolve()
        if not (root / "train").exists():
            raise FileNotFoundError(f"Expected a train folder inside {root}")
        return root

    candidates = [
        Path("data/raw/dataset2/PlantDoc-Dataset-master"),
        Path("data/raw/dataset2"),
    ]
    for candidate in candidates:
        if (candidate / "train").exists():
            return candidate.resolve()

    raise FileNotFoundError("Could not auto-detect dataset2 root with a train folder.")


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


def split_indices_by_class(
    image_folder: datasets.ImageFolder,
    valid_split: float,
    seed: int,
) -> tuple[list[int], list[int], dict[str, int]]:
    if not 0 < valid_split < 1:
        raise ValueError("--valid-split must be between 0 and 1.")

    rng = random.Random(seed)
    train_indices: list[int] = []
    valid_indices: list[int] = []
    validation_counts: dict[str, int] = {}

    for class_index, class_name in enumerate(image_folder.classes):
        class_indices = [idx for idx, target in enumerate(image_folder.targets) if target == class_index]
        rng.shuffle(class_indices)

        if len(class_indices) < 3:
            valid_count = 0
        else:
            valid_count = max(1, round(len(class_indices) * valid_split))
            valid_count = min(valid_count, len(class_indices) - 1)

        valid_for_class = class_indices[:valid_count]
        train_for_class = class_indices[valid_count:]

        train_indices.extend(train_for_class)
        valid_indices.extend(valid_for_class)
        validation_counts[class_name] = len(valid_for_class)

    if not valid_indices:
        raise ValueError("Validation split is empty. Increase dataset size or valid split.")

    return train_indices, valid_indices, validation_counts


def build_loaders(
    train_dir: Path,
    batch_size: int,
    num_workers: int,
    valid_split: float,
    seed: int,
    max_train_samples: int | None,
    max_valid_samples: int | None,
) -> tuple[Dataset, Dataset, list[str], dict[str, int]]:
    train_transform, eval_transform = build_transforms()
    base_dataset = datasets.ImageFolder(train_dir)
    train_indices, valid_indices, validation_counts = split_indices_by_class(
        base_dataset, valid_split, seed
    )

    if max_train_samples is not None:
        train_indices = train_indices[: min(max_train_samples, len(train_indices))]
    if max_valid_samples is not None:
        valid_indices = valid_indices[: min(max_valid_samples, len(valid_indices))]

    train_dataset = TransformedSubset(base_dataset, train_indices, train_transform)
    valid_dataset = TransformedSubset(base_dataset, valid_indices, eval_transform)

    return train_dataset, valid_dataset, base_dataset.classes, validation_counts


def resolve_dataset1_root(dataset1_root: Path | None) -> Path:
    if dataset1_root:
        root = dataset1_root.expanduser().resolve()
        if (root / "train").exists():
            return root
        raise FileNotFoundError(f"Expected a train folder inside {root}")

    candidates = [
        Path("data/raw/dataset1/New Plant Diseases Dataset(Augmented)/New Plant Diseases Dataset(Augmented)"),
        Path("data/raw/dataset1/New Plant Diseases Dataset(Augmented)"),
        Path("data/raw/dataset1"),
    ]
    for candidate in candidates:
        if (candidate / "train").exists():
            return candidate.resolve()
    raise FileNotFoundError("Could not auto-detect dataset1 root for augmentation.")


def build_dataset1_augmentation_dataset(
    dataset1_root: Path,
    dataset2_classes: list[str],
    transform,
    seed: int,
    max_samples_per_class: int | None,
) -> tuple[PathLabelDataset, dict[str, int]]:
    dataset2_class_to_idx = {class_name: idx for idx, class_name in enumerate(dataset2_classes)}
    rng = random.Random(seed)
    mapped_samples_by_class = {class_name: [] for class_name in dataset2_classes}
    counts_by_class = {class_name: 0 for class_name in dataset2_classes}

    for split_name in ("train", "valid"):
        split_dir = dataset1_root / split_name
        if not split_dir.exists():
            continue
        image_folder = datasets.ImageFolder(split_dir)
        for image_path, source_target in image_folder.samples:
            source_class = image_folder.classes[source_target]
            mapped_class = DATASET1_TO_DATASET2_LABEL_MAP.get(source_class)
            if mapped_class is None or mapped_class not in dataset2_class_to_idx:
                continue
            mapped_target = dataset2_class_to_idx[mapped_class]
            mapped_samples_by_class[mapped_class].append((image_path, mapped_target))

    mapped_samples: list[tuple[str, int]] = []
    for class_name, class_samples in mapped_samples_by_class.items():
        rng.shuffle(class_samples)
        if max_samples_per_class is not None:
            class_samples = class_samples[:max_samples_per_class]
        mapped_samples.extend(class_samples)
        counts_by_class[class_name] = len(class_samples)

    return PathLabelDataset(mapped_samples, dataset2_classes, transform), counts_by_class


def get_targets_for_dataset(dataset: Dataset) -> list[int]:
    if hasattr(dataset, "targets"):
        return list(getattr(dataset, "targets"))
    if isinstance(dataset, ConcatDataset):
        targets: list[int] = []
        for child in dataset.datasets:
            targets.extend(get_targets_for_dataset(child))
        return targets
    raise ValueError("Dataset does not expose targets for balancing.")


def build_class_counts(targets: list[int], num_classes: int) -> list[int]:
    counts = [0] * num_classes
    for target in targets:
        counts[target] += 1
    return counts


def compute_balancing_weights(counts: list[int], power: float) -> list[float]:
    raw_weights = []
    for count in counts:
        effective_count = max(count, 1)
        raw_weights.append((1.0 / effective_count) ** power)
    mean_weight = sum(raw_weights) / max(len(raw_weights), 1)
    return [weight / mean_weight for weight in raw_weights]


def build_train_loader(
    train_dataset: Dataset,
    batch_size: int,
    num_workers: int,
    num_classes: int,
    balance_power: float,
    use_weighted_sampler: bool,
) -> tuple[DataLoader, list[int]]:
    targets = get_targets_for_dataset(train_dataset)
    train_class_counts = build_class_counts(targets, num_classes)
    if use_weighted_sampler:
        class_weights = compute_balancing_weights(train_class_counts, balance_power)
        sample_weights = [class_weights[target] for target in targets]
        sampler = WeightedRandomSampler(
            weights=torch.DoubleTensor(sample_weights),
            num_samples=len(sample_weights),
            replacement=True,
        )
        train_loader = DataLoader(
            train_dataset,
            batch_size=batch_size,
            sampler=sampler,
            num_workers=num_workers,
            pin_memory=torch.cuda.is_available(),
        )
    else:
        train_loader = DataLoader(
            train_dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=num_workers,
            pin_memory=torch.cuda.is_available(),
        )
    return train_loader, train_class_counts


def build_eval_loader(dataset: Dataset, batch_size: int, num_workers: int) -> DataLoader:
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )


def build_model(
    num_classes: int,
    architecture: str,
    pretrained: bool,
    freeze_backbone: bool,
) -> nn.Module:
    if architecture == "resnet18":
        weights = models.ResNet18_Weights.DEFAULT if pretrained else None
        model = models.resnet18(weights=weights)
    elif architecture == "resnet34":
        weights = models.ResNet34_Weights.DEFAULT if pretrained else None
        model = models.resnet34(weights=weights)
    else:
        raise ValueError(f"Unsupported architecture: {architecture}")
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


def save_outputs(model: nn.Module, classes: list[str], output_dir: Path, metadata: dict) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    architecture = metadata["architecture"]
    checkpoint_path = output_dir / f"dataset2_{architecture}_best.pt"
    labels_path = output_dir / "dataset2_labels.json"
    metrics_path = output_dir / "dataset2_training_metrics.json"

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "classes": classes,
            "architecture": architecture,
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
    architecture = metadata["architecture"]
    latest_checkpoint_path = output_dir / f"dataset2_{architecture}_latest.pt"
    progress_path = output_dir / "dataset2_training_progress.json"
    labels_path = output_dir / "dataset2_labels.json"

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "classes": classes,
            "architecture": architecture,
            "image_size": IMAGE_SIZE,
            "epoch": epoch,
        },
        latest_checkpoint_path,
    )
    labels_path.write_text(json.dumps(classes, indent=2), encoding="utf-8")
    progress_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    if is_best:
        best_checkpoint_path = output_dir / f"dataset2_{architecture}_best.pt"
        torch.save(
            {
                "model_state_dict": model.state_dict(),
                "classes": classes,
                "architecture": architecture,
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
    parser = argparse.ArgumentParser(description="Train a plant disease classifier on dataset2.")
    parser.add_argument("--dataset-root", type=Path, default=None, help="Path containing train/ and test/.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("models/dataset2_run"),
        help="Where to save artifacts.",
    )
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--learning-rate", type=float, default=DEFAULT_LEARNING_RATE)
    parser.add_argument("--num-workers", type=int, default=DEFAULT_NUM_WORKERS)
    parser.add_argument(
        "--architecture",
        choices=["resnet18", "resnet34"],
        default=DEFAULT_ARCHITECTURE,
        help="Backbone architecture.",
    )
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
    parser.add_argument("--balance-power", type=float, default=DEFAULT_BALANCE_POWER)
    parser.add_argument(
        "--max-dataset1-samples-per-class",
        type=int,
        default=DEFAULT_MAX_DATASET1_SAMPLES_PER_CLASS,
        help="Cap borrowed dataset1 samples per mapped class.",
    )
    parser.add_argument("--valid-split", type=float, default=DEFAULT_VALID_SPLIT)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--dataset1-root", type=Path, default=None, help="Optional dataset1 root for augmentation.")
    parser.add_argument("--augment-with-dataset1", dest="augment_with_dataset1", action="store_true")
    parser.add_argument("--no-augment-with-dataset1", dest="augment_with_dataset1", action="store_false")
    parser.add_argument("--weighted-sampler", dest="weighted_sampler", action="store_true")
    parser.add_argument("--no-weighted-sampler", dest="weighted_sampler", action="store_false")
    parser.add_argument("--class-weighted-loss", dest="class_weighted_loss", action="store_true")
    parser.add_argument("--no-class-weighted-loss", dest="class_weighted_loss", action="store_false")
    parser.add_argument(
        "--freeze-backbone-epochs",
        type=int,
        default=DEFAULT_FREEZE_BACKBONE_EPOCHS,
        help="Train only the classifier head for the first N epochs, then fine-tune the full model.",
    )
    parser.add_argument("--max-train-samples", type=int, default=None)
    parser.add_argument("--max-valid-samples", type=int, default=None)
    parser.add_argument("--pretrained", dest="pretrained", action="store_true")
    parser.add_argument("--no-pretrained", dest="pretrained", action="store_false")
    parser.set_defaults(pretrained=True)
    parser.set_defaults(augment_with_dataset1=True, weighted_sampler=True, class_weighted_loss=True)
    parser.add_argument(
        "--freeze-backbone",
        action="store_true",
        help="Keep the backbone frozen for the entire run.",
    )
    args = parser.parse_args()

    torch_cache_dir = ensure_torch_cache_dir(args.torch_cache_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    dataset_root = resolve_dataset_root(args.dataset_root)
    train_dir = dataset_root / "train"
    test_dir = dataset_root / "test"

    train_dataset, valid_dataset, classes, validation_counts = build_loaders(
        train_dir=train_dir,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        valid_split=args.valid_split,
        seed=args.seed,
        max_train_samples=args.max_train_samples,
        max_valid_samples=args.max_valid_samples,
    )
    augmentation_counts_by_class = {class_name: 0 for class_name in classes}
    if args.augment_with_dataset1:
        dataset1_root = resolve_dataset1_root(args.dataset1_root)
        _, train_transform = None, None
        train_transform, _ = build_transforms()
        dataset1_aug_dataset, augmentation_counts_by_class = build_dataset1_augmentation_dataset(
            dataset1_root=dataset1_root,
            dataset2_classes=classes,
            transform=train_transform,
            seed=args.seed,
            max_samples_per_class=args.max_dataset1_samples_per_class,
        )
        train_dataset = ConcatDataset([train_dataset, dataset1_aug_dataset])
    else:
        dataset1_root = None

    train_loader, train_class_counts = build_train_loader(
        train_dataset=train_dataset,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        num_classes=len(classes),
        balance_power=args.balance_power,
        use_weighted_sampler=args.weighted_sampler,
    )
    valid_loader = build_eval_loader(valid_dataset, args.batch_size, args.num_workers)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    start_with_frozen_backbone = args.freeze_backbone or args.freeze_backbone_epochs > 0
    model = build_model(
        num_classes=len(classes),
        architecture=args.architecture,
        pretrained=args.pretrained,
        freeze_backbone=start_with_frozen_backbone,
    ).to(device)
    loss_weights = None
    if args.class_weighted_loss:
        normalized_weights = compute_balancing_weights(train_class_counts, args.balance_power)
        loss_weights = torch.tensor(normalized_weights, dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(label_smoothing=args.label_smoothing, weight=loss_weights)
    optimizer = make_optimizer(model, args.learning_rate, args.weight_decay)
    scheduler = ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=1)
    use_amp = device.type == "cuda"

    best_state = deepcopy(model.state_dict())
    best_val_accuracy = 0.0
    history: list[dict] = []
    epochs_without_improvement = 0
    classes_without_validation = [
        class_name for class_name, validation_count in validation_counts.items() if validation_count == 0
    ]

    print(f"Dataset root: {dataset_root}")
    print(f"Train images: {len(train_loader.dataset)}")
    print(f"Validation images: {len(valid_loader.dataset)}")
    print(f"Classes: {len(classes)}")
    print(f"Device: {device}")
    print(f"AMP enabled: {use_amp}")
    print(f"Torch cache dir: {torch_cache_dir}")
    print(f"Classes without validation samples: {classes_without_validation}")
    print(f"Dataset test dir detected: {test_dir.exists()}")
    print(f"Dataset1 augmentation enabled: {args.augment_with_dataset1}")
    print(f"Weighted sampler enabled: {args.weighted_sampler}")
    print(f"Class-weighted loss enabled: {args.class_weighted_loss}")

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
            "test_dir": str(test_dir.resolve()) if test_dir.exists() else None,
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "learning_rate": args.learning_rate,
            "architecture": args.architecture,
            "weight_decay": args.weight_decay,
            "label_smoothing": args.label_smoothing,
            "pretrained": args.pretrained,
            "freeze_backbone": args.freeze_backbone,
            "freeze_backbone_epochs": args.freeze_backbone_epochs,
            "patience": args.patience,
            "min_delta": args.min_delta,
            "balance_power": args.balance_power,
            "max_dataset1_samples_per_class": args.max_dataset1_samples_per_class,
            "valid_split": args.valid_split,
            "seed": args.seed,
            "max_train_samples": args.max_train_samples,
            "max_valid_samples": args.max_valid_samples,
            "dataset1_root": str(dataset1_root) if dataset1_root is not None else None,
            "augment_with_dataset1": args.augment_with_dataset1,
            "weighted_sampler": args.weighted_sampler,
            "class_weighted_loss": args.class_weighted_loss,
            "best_val_accuracy": best_val_accuracy,
            "device": str(device),
            "amp_enabled": use_amp,
            "torch_cache_dir": str(torch_cache_dir),
            "completed_epochs": epoch,
            "stopped_early": False,
            "classes_without_validation_samples": classes_without_validation,
            "validation_counts_by_class": validation_counts,
            "train_class_counts": {class_name: train_class_counts[idx] for idx, class_name in enumerate(classes)},
            "dataset1_augmentation_counts_by_class": augmentation_counts_by_class,
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
        "test_dir": str(test_dir.resolve()) if test_dir.exists() else None,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "architecture": args.architecture,
        "weight_decay": args.weight_decay,
        "label_smoothing": args.label_smoothing,
        "pretrained": args.pretrained,
        "freeze_backbone": args.freeze_backbone,
        "freeze_backbone_epochs": args.freeze_backbone_epochs,
        "patience": args.patience,
        "min_delta": args.min_delta,
        "balance_power": args.balance_power,
        "max_dataset1_samples_per_class": args.max_dataset1_samples_per_class,
        "valid_split": args.valid_split,
        "seed": args.seed,
        "max_train_samples": args.max_train_samples,
        "max_valid_samples": args.max_valid_samples,
        "dataset1_root": str(dataset1_root) if dataset1_root is not None else None,
        "augment_with_dataset1": args.augment_with_dataset1,
        "weighted_sampler": args.weighted_sampler,
        "class_weighted_loss": args.class_weighted_loss,
        "best_val_accuracy": best_val_accuracy,
        "device": str(device),
        "amp_enabled": use_amp,
        "torch_cache_dir": str(torch_cache_dir),
        "completed_epochs": len(history),
        "stopped_early": epochs_without_improvement >= args.patience,
        "classes_without_validation_samples": classes_without_validation,
        "validation_counts_by_class": validation_counts,
        "train_class_counts": {class_name: train_class_counts[idx] for idx, class_name in enumerate(classes)},
        "dataset1_augmentation_counts_by_class": augmentation_counts_by_class,
        "history": history,
    }
    save_outputs(model, classes, args.output_dir, metadata)

    print(f"Best validation accuracy: {best_val_accuracy:.4f}")
    print(f"Saved checkpoint to: {(args.output_dir / f'dataset2_{args.architecture}_best.pt').resolve()}")


if __name__ == "__main__":
    main()
