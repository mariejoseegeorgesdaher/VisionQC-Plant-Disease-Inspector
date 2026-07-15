from __future__ import annotations

"""
VisionQC local classifier
=========================

This module is responsible only for local model inference.

Responsibilities:
- load the trained checkpoint and labels
- preprocess the uploaded image
- run the PyTorch model
- return the predicted label and confidence

This module does NOT:
- analyze photo quality
- generate human-readable explanations
- build the final API response

Those steps are handled elsewhere by:
- `photo_quality.py`
- `ollama_client.py`
- `main.py`
"""

import io
import json
import os
from functools import lru_cache
from pathlib import Path

import torch
from PIL import Image
from torchvision import models, transforms


DEFAULT_CHECKPOINT = Path("models/dataset1_gpu_run_20260426/dataset1_resnet18_best.pt")
DEFAULT_LABELS = Path("models/dataset1_gpu_run_20260426/dataset1_labels.json")
IMAGE_SIZE = 224

#This Function prepares the photo to be sent to the AI
#It resizes, convert to tensor and normalize colors
#This work is done because ResNet expects images normalized this way
def build_eval_transform() -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

#this function returns a tuple (fixed pair/group of values ) of 2 paths
# path of the ai model file in the project
# path of label files in the project
def get_local_model_paths() -> tuple[Path, Path]:
    checkpoint = Path(os.getenv("LOCAL_MODEL_CHECKPOINT", str(DEFAULT_CHECKPOINT))).resolve()
    labels = Path(os.getenv("LOCAL_MODEL_LABELS", str(DEFAULT_LABELS))).resolve()
    return checkpoint, labels

#build the ai model
def build_model(architecture: str, num_classes: int) -> torch.nn.Module:
    if architecture == "resnet18":
        model = models.resnet18(weights=None)
    elif architecture == "resnet34":
        model = models.resnet34(weights=None)
    else:
        raise ValueError(f"Unsupported local model architecture: {architecture}")
    #this line tell the resnet18 that the final output must be 28 and not the default 1000
    model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
    return model


#load model only once, not on every scan
@lru_cache(maxsize=1)
def load_local_model() -> tuple[torch.nn.Module, list[str], torch.device, str]:

    checkpoint_path, labels_path = get_local_model_paths()
    #checking if paths values exists , if not raise an error
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Local checkpoint not found: {checkpoint_path}")
    if not labels_path.exists():
        raise FileNotFoundError(f"Local labels file not found: {labels_path}")
    
    #get classes from path
    classes = json.loads(labels_path.read_text(encoding="utf-8"))
    #device to use :If GPU/CUDA is available, use GPU otherwise use CPU.
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    #load the model weights onto the selected device
    checkpoint = torch.load(checkpoint_path, map_location=device)
    #ResNet18 has about 18 main learnable layers total, not 18 layers in each stage.
    #ResNet high-level phases:
    #1. Image input: receives a resized normalized image tensor, usually 3 x 224 x 224.
    #2. First convolution: detects simple patterns such as edges, colors, and textures.
    #3. Pooling: reduces feature-map size so processing is faster and more focused.
    #4. Residual blocks: pass features through convolution layers with shortcut connections.
    #5. Deeper feature extraction: combines simple patterns into leaf/disease-like features.
    #6. Average pooling: summarizes all detected features into one compact feature vector.
    #7. Final class scores: the fully connected layer outputs one score per disease label.
    architecture = checkpoint.get("architecture", "resnet18")

    #creating a model with the expected output to be x number of the length of classes
    #ya3ne eza fi 28 class lezim le output ykoun 28 number 3an 28 layers
    model = build_model(architecture, len(classes))
    #load learned weights
    model.load_state_dict(checkpoint["model_state_dict"])
    #moves the model to the selected device
    model.to(device)
    #set model to prediction mode not training mode, because this model can do both
    model.eval()
    #model is the PyTorch model.
    #classes is the list of labels/disease names.
    #device is CPU or GPU.
    #architecture defines the structure the AI uses to learn and later analyze images
    return model, classes, device, architecture

#image -> resize -> tensor -> normalize -> model predicts
#same steps as
def classify_image(image_bytes: bytes) -> tuple[str, float, str]:
    #previous function
    model, classes, device, architecture = load_local_model()
    #convert the image into a pil image because it works smoothly with PyTorch/Torchvision preprocessing.
    #resize to 224x224
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    #convert to tensor 1 x 3 x 224 x 224
    # 3D tensor: stack of matrices
    # [
    # [[1, 2], [3, 4]],
    # [[5, 6], [7, 8]]
    # ]
    #1     = batch size, meaning one image
    # 3     = color channels: Red, Green, Blue
    # 224   = image height
    # 224   = image width
    tensor = build_eval_transform()(image).unsqueeze(0).to(device)

    #prediction part
    #This tells PyTorch We are only predicting, not training
    with torch.no_grad():
        #logits returns raw scores, one for each class
        logits = model(tensor)
        #This converts raw scores into probabilities (this is confidence level) 
        probabilities = torch.softmax(logits, dim=1)
        #max chooses the highest probability
        confidence, predicted_index = probabilities.max(dim=1)
    #return the label with the confidence level
    label = classes[predicted_index.item()]
    return label, float(confidence.item()), architecture

#human readable labels, better for ui
def humanize_label(label: str) -> str:
    explicit_labels = {
        "Apple___Apple_scab": "Apple scab",
        "Apple___Black_rot": "Apple black rot",
        "Apple___Cedar_apple_rust": "Apple cedar rust",
        "Apple___healthy": "Healthy apple leaf",
        "Apple Scab Leaf": "Apple scab",
        "Apple leaf": "Healthy apple leaf",
        "Apple rust leaf": "Apple rust",
        "Bell_pepper leaf": "Healthy bell pepper leaf",
        "Bell_pepper leaf spot": "Bell pepper bacterial spot",
        "Blueberry___healthy": "Healthy blueberry leaf",
        "Blueberry leaf": "Healthy blueberry leaf",
        "Cherry_(including_sour)___Powdery_mildew": "Cherry powdery mildew",
        "Cherry_(including_sour)___healthy": "Healthy cherry leaf",
        "Cherry leaf": "Healthy cherry leaf",
        "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Corn gray leaf spot",
        "Corn_(maize)___Common_rust_": "Corn common rust",
        "Corn_(maize)___Northern_Leaf_Blight": "Corn northern leaf blight",
        "Corn_(maize)___healthy": "Healthy corn leaf",
        "Corn Gray leaf spot": "Corn gray leaf spot",
        "Corn leaf blight": "Corn leaf blight",
        "Corn rust leaf": "Corn rust",
        "Grape___Black_rot": "Grape black rot",
        "Grape___Esca_(Black_Measles)": "Grape black measles",
        "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Grape leaf blight",
        "Grape___healthy": "Healthy grape leaf",
        "Orange___Haunglongbing_(Citrus_greening)": "Citrus greening",
        "Peach___Bacterial_spot": "Peach bacterial spot",
        "Peach___healthy": "Healthy peach leaf",
        "Peach leaf": "Healthy peach leaf",
        "Pepper,_bell___Bacterial_spot": "Bell pepper bacterial spot",
        "Pepper,_bell___healthy": "Healthy bell pepper leaf",
        "Potato___Early_blight": "Potato early blight",
        "Potato___Late_blight": "Potato late blight",
        "Potato___healthy": "Healthy potato leaf",
        "Potato leaf early blight": "Potato early blight",
        "Potato leaf late blight": "Potato late blight",
        "Raspberry___healthy": "Healthy raspberry leaf",
        "Raspberry leaf": "Healthy raspberry leaf",
        "Soybean___healthy": "Healthy soybean leaf",
        "Soyabean leaf": "Healthy soybean leaf",
        "Squash___Powdery_mildew": "Squash powdery mildew",
        "Squash Powdery mildew leaf": "Squash powdery mildew",
        "Strawberry___Leaf_scorch": "Strawberry leaf scorch",
        "Strawberry___healthy": "Healthy strawberry leaf",
        "Strawberry leaf": "Healthy strawberry leaf",
        "Tomato___Bacterial_spot": "Tomato bacterial spot",
        "Tomato___Early_blight": "Tomato early blight",
        "Tomato___Late_blight": "Tomato late blight",
        "Tomato___Leaf_Mold": "Tomato leaf mold",
        "Tomato___Septoria_leaf_spot": "Tomato Septoria leaf spot",
        "Tomato___Spider_mites Two-spotted_spider_mite": "Tomato spider mite damage",
        "Tomato___Target_Spot": "Tomato target spot",
        "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Tomato yellow leaf curl virus",
        "Tomato___Tomato_mosaic_virus": "Tomato mosaic virus",
        "Tomato___healthy": "Healthy tomato leaf",
        "Tomato Early blight leaf": "Tomato early blight",
        "Tomato Septoria leaf spot": "Tomato Septoria leaf spot",
        "Tomato leaf": "Healthy tomato leaf",
        "Tomato leaf bacterial spot": "Tomato bacterial spot",
        "Tomato leaf late blight": "Tomato late blight",
        "Tomato leaf mosaic virus": "Tomato mosaic virus",
        "Tomato leaf yellow virus": "Tomato yellow leaf curl virus",
        "Tomato mold leaf": "Tomato leaf mold",
        "Tomato two spotted spider mites leaf": "Tomato spider mite damage",
        "grape leaf": "Healthy grape leaf",
        "grape leaf black rot": "Grape black rot",
    }
    #return human label 
    if label in explicit_labels:
        return explicit_labels[label]
    #additional normalizing
    normalized = label.replace("_", " ").strip()
    return normalized[:1].upper() + normalized[1:] if normalized else label
