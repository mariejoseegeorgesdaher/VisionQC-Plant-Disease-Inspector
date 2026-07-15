# Training Notes

## Dataset 1

- Name: New Plant Diseases Dataset
- Source: Kaggle
- Purpose: Image classification for plant disease detection
- Expected structure: `train/`, `valid/` or `validation/`, and possibly `test/`
- Planned local path: `data/raw/dataset1`
- Detected local training path: `data/raw/dataset1/New Plant Diseases Dataset(Augmented)/New Plant Diseases Dataset(Augmented)`
- Detected validation path: `valid/`
- Number of classes detected: `38`

## Training Command

```bash
python scripts/train_dataset1.py --epochs 5 --batch-size 32
```

Quick CPU-friendly first run:

```bash
python scripts/train_dataset1.py --epochs 1 --batch-size 32 --max-train-samples 12000 --max-valid-samples 3000 --freeze-backbone
```

## Output Files

- `models/dataset1_resnet18_best.pt`
- `models/dataset1_labels.json`
- `models/dataset1_training_metrics.json`
