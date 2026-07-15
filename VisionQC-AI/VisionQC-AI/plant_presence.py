from __future__ import annotations

import cv2
import numpy as np

from photo_quality import decode_image
from schemas import PlantPresenceReport

#this file checks that Does this image look enough like a plant/leaf image?
# Keep this threshold conservative: the gate should reject obvious non-plant images
# without blocking real plant photos that have unusual colors or backgrounds.
MIN_PLANT_CONFIDENCE = 0.18

#This calculates how much of the image matches a condition
def ratio(mask: np.ndarray) -> float:
    return float(np.count_nonzero(mask) / max(mask.size, 1))


def analyze_plant_presence(image_bytes: bytes) -> PlantPresenceReport:
    #decoding image
    image = decode_image(image_bytes)
    #Hue        tells the color
    #Saturation tells how strong the color is
    #Value       tells brightness
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    #grayscale is the measure of brightness / intensity from 0 to 255
    #used for edge detection
    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    #Splits the HSV image into separate channels.
    hue = hsv[:, :, 0]
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]

#find corresponding colors pixels
    green_mask = (hue >= 35) & (hue <= 90) & (saturation >= 35) & (value >= 35)
    yellow_mask = (hue >= 18) & (hue < 35) & (saturation >= 45) & (value >= 45)
    brown_mask = (hue >= 5) & (hue < 25) & (saturation >= 35) & (value >= 25) & (value <= 210)
    plant_mask = green_mask | yellow_mask | brown_mask

    #calculate green-only ratio because green is the strongest plant-like color signal
    green_ratio = ratio(green_mask)
    #calculating overall plant presence
    plant_color_ratio = ratio(plant_mask)

    #boolean values that compare values to values document_like

    # document have low saturation: black/white/gray
    low_saturation_ratio = ratio(saturation < 28)
    #checks white/light gray background, like paper or a document page
    bright_background_ratio = ratio((saturation < 35) & (value > 175))
    #Checks how many sharp edges ( pixel brightness changes suddenly) are in the image
    edge_ratio = ratio(cv2.Canny(grayscale, 80, 160) > 0)

    #calculate document like ratio
    document_like_ratio = min(1.0, (low_saturation_ratio * 0.45) + (bright_background_ratio * 0.4) + (edge_ratio * 1.5))

    #calculate confidence score
    confidence = max(0.0, min(1.0, (plant_color_ratio * 2.4) + (green_ratio * 1.2) - (document_like_ratio * 0.45)))
    # kel ma arabit 3al 1 kel ma look like plant aktar 
    is_plant_like = confidence >= MIN_PLANT_CONFIDENCE

    reason = (
        "The image has enough plant-like color and texture for diagnosis."
        if is_plant_like
        else "This does not look enough like a plant leaf image for diagnosis."
    )

    return PlantPresenceReport(
        isPlantLike=is_plant_like,
        confidence=confidence,
        plantColorRatio=plant_color_ratio,
        greenRatio=green_ratio,
        documentLikeRatio=document_like_ratio,
        reason=reason,
    )
