from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from torchvision import datasets, models, transforms


IMAGE_SIZE = 224


def build_eval_transform() -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


def resolve_test_root(test_root: Path | None) -> Path:
    if test_root:
        root = test_root.expanduser().resolve()
        if root.exists():
            return root
        raise FileNotFoundError(f"Could not find test root: {root}")

    candidate = Path("data/raw/dataset2/PlantDoc-Dataset-master/test")
    if candidate.exists():
        return candidate.resolve()
    raise FileNotFoundError("Could not auto-detect dataset2 test folder.")


def load_model(checkpoint_path: Path, labels_path: Path, device: torch.device) -> tuple[torch.nn.Module, list[str]]:
    classes = json.loads(labels_path.read_text(encoding="utf-8"))
    checkpoint = torch.load(checkpoint_path, map_location=device)
    architecture = checkpoint.get("architecture", "resnet18")
    if architecture == "resnet18":
        model = models.resnet18(weights=None)
    elif architecture == "resnet34":
        model = models.resnet34(weights=None)
    else:
        raise ValueError(f"Unsupported architecture in checkpoint: {architecture}")
    model.fc = torch.nn.Linear(model.fc.in_features, len(classes))
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()
    return model, classes


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate dataset2 model on held-out dataset2/test.")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--test-root", type=Path, default=None)
    parser.add_argument(
        "--output-json",
        type=Path,
        default=None,
        help="Optional path for evaluation metrics JSON.",
    )
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, model_classes = load_model(args.checkpoint, args.labels, device)
    test_root = resolve_test_root(args.test_root)
    test_dataset = datasets.ImageFolder(test_root, transform=build_eval_transform())

    model_class_to_idx = {class_name: idx for idx, class_name in enumerate(model_classes)}
    common_classes = [class_name for class_name in test_dataset.classes if class_name in model_class_to_idx]
    missing_from_test = [class_name for class_name in model_classes if class_name not in test_dataset.classes]
    missing_from_model = [class_name for class_name in test_dataset.classes if class_name not in model_class_to_idx]

    if not common_classes:
        raise ValueError("No overlapping classes between checkpoint labels and dataset2 test set.")

    filtered_indices = [
        idx
        for idx, (_, target) in enumerate(test_dataset.samples)
        if test_dataset.classes[target] in model_class_to_idx
    ]
    subset = torch.utils.data.Subset(test_dataset, filtered_indices)
    loader = torch.utils.data.DataLoader(
        subset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=torch.cuda.is_available(),
    )

    correct = 0
    total = 0
    per_class_total = {class_name: 0 for class_name in common_classes}
    per_class_correct = {class_name: 0 for class_name in common_classes}

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)
            outputs = model(images)
            predictions = outputs.argmax(dim=1)

            for prediction, label in zip(predictions, labels):
                test_class_name = test_dataset.classes[label.item()]
                mapped_target = model_class_to_idx[test_class_name]
                is_correct = prediction.item() == mapped_target
                per_class_total[test_class_name] += 1
                per_class_correct[test_class_name] += int(is_correct)
                correct += int(is_correct)
                total += 1

    per_class_accuracy = {
        class_name: (
            per_class_correct[class_name] / per_class_total[class_name]
            if per_class_total[class_name]
            else 0.0
        )
        for class_name in common_classes
    }
    metrics = {
        "checkpoint": str(args.checkpoint.resolve()),
        "labels": str(args.labels.resolve()),
        "test_root": str(test_root),
        "device": str(device),
        "overall_accuracy": correct / max(total, 1),
        "evaluated_samples": total,
        "common_classes": common_classes,
        "missing_model_classes_in_test": missing_from_test,
        "missing_test_classes_in_model": missing_from_model,
        "per_class_accuracy": per_class_accuracy,
        "per_class_total": per_class_total,
    }

    print(json.dumps(metrics, indent=2))
    if args.output_json is not None:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(json.dumps(metrics, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
