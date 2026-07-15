from __future__ import annotations

import cv2
import numpy as np

from schemas import PhotoQualityMetrics, PhotoQualityReport


MIN_RESOLUTION = 600
MIN_BLUR_VARIANCE = 80.0
MIN_BRIGHTNESS = 60.0
MAX_BRIGHTNESS = 200.0
MIN_CONTRAST = 35.0

#called in this file in analyze_photo_quality function
#this function turn the image_bytes into a real image so it can be quality scanned
def decode_image(image_bytes: bytes) -> np.ndarray:
    #np.frombuffer converts the raw bytes into a NumPy array because OpenCV expect numpy array not raw bytes
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    #OpenCV convert the array to pixels
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    #if decoding fails because of :
        # the file is corrupted
        # the file extension/content type says image but the content is not image data
        # the bytes are incomplete
        # OpenCV cannot decode that image format
    # raise an error
    if image is None:
        raise ValueError("Invalid image file.")
    return image

#called in this file in analyze_photo_quality function
def build_retake_advice(issues: list[str]) -> str:
    if not issues:
        return "The photo quality looks good enough for diagnosis."

    advice_parts: list[str] = []
    if "Image is blurry." in issues:
        advice_parts.append("Hold the camera steady and refocus before taking the picture.")
    if "Image is too dark." in issues:
        advice_parts.append("Move to brighter light or avoid deep shadows.")
    if "Image is too bright." in issues:
        advice_parts.append("Avoid harsh glare or strong direct sunlight on the leaf.")
    if "Image has low contrast." in issues:
        advice_parts.append("Make sure the leaf stands out clearly from the background.")
    if "Image resolution is too low." in issues:
        advice_parts.append("Retake the photo closer to the plant with a clearer, higher-resolution image.")

    return " ".join(advice_parts) if advice_parts else "Retake the photo with better quality."

# function called in main.py
#it analyses the quality of the photo and return result in the PhotoQualityReport function format (function found in schemas.py)
def analyze_photo_quality(image_bytes: bytes) -> PhotoQualityReport:
    #decode image
    image = decode_image(image_bytes)
    #Gets the image dimensions
    height, width = image.shape[:2]
    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    #Measures sharpness/blurriness : Higher value = sharper , Lower value = blurrier
    blur = float(cv2.Laplacian(grayscale, cv2.CV_64F).var())
    #Measures average brightness: Low = dark, High = bright
    brightness = float(grayscale.mean())
    #Measures contrast: Low contrast means the image looks flat and details do not stand out.
    #Because blur, brightness, and contrast can be measured from light intensity.
    contrast = float(grayscale.std())

    issues: list[str] = []
    penalties = 0

    #address variables to issues and address penalities
    if blur < MIN_BLUR_VARIANCE:
        issues.append("Image is blurry.")
        penalties += 30
    if brightness < MIN_BRIGHTNESS:
        issues.append("Image is too dark.")
        penalties += 20
    if brightness > MAX_BRIGHTNESS:
        issues.append("Image is too bright.")
        penalties += 15
    if contrast < MIN_CONTRAST:
        issues.append("Image has low contrast.")
        penalties += 15
    if width < MIN_RESOLUTION or height < MIN_RESOLUTION:
        issues.append("Image resolution is too low.")
        penalties += 25

    quality_score = max(0, 100 - penalties)
    #If there are no issues (empty list), canDiagnose = True.
    #If any issue exists(not empty list), canDiagnose = False.
    can_diagnose = not issues

    return PhotoQualityReport(
        qualityScore=quality_score,
        canDiagnose=can_diagnose,
        issues=issues,
        metrics=PhotoQualityMetrics(
            blur=blur,
            brightness=brightness,
            contrast=contrast,
            width=width,
            height=height,
        ),
        #solutions for the issues
        retakeAdvice=build_retake_advice(issues),
    )
