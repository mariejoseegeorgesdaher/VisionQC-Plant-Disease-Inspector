export async function analyzeScanQuality(imageUrl) {
  if (!imageUrl || typeof document === "undefined") {
    return null;
  }

  const image = await new Promise((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Failed to inspect the selected image."));
    nextImage.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  const targetWidth = 140;
  const scale = targetWidth / image.width;
  canvas.width = targetWidth;
  canvas.height = Math.max(1, Math.round(image.height * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let brightnessTotal = 0;
  let pixelCount = 0;
  let focusScoreTotal = 0;
  let centerFocusScoreTotal = 0;
  let darkPixelCount = 0;
  let brightPixelCount = 0;
  let lowContrastPixelCount = 0;
  let saturatedPixelCount = 0;
  let centerSubjectPixelCount = 0;
  let totalSubjectPixelCount = 0;
  let centerPixelCount = 0;

  const centerStartX = Math.floor(canvas.width * 0.2);
  const centerEndX = Math.ceil(canvas.width * 0.8);
  const centerStartY = Math.floor(canvas.height * 0.2);
  const centerEndY = Math.ceil(canvas.height * 0.8);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const currentGray = (red + green + blue) / 3;
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
      const isCenterPixel =
        x >= centerStartX && x < centerEndX && y >= centerStartY && y < centerEndY;

      brightnessTotal += currentGray;
      pixelCount += 1;
      saturatedPixelCount += saturation >= 0.18 ? 1 : 0;

      if (isCenterPixel) {
        centerPixelCount += 1;
      }

      if (currentGray < 45) {
        darkPixelCount += 1;
      } else if (currentGray > 225) {
        brightPixelCount += 1;
      }

      if (maxChannel - minChannel < 18) {
        lowContrastPixelCount += 1;
      }

      if (x > 0 && y > 0) {
        const leftIndex = index - 4;
        const topIndex = index - canvas.width * 4;
        const leftGray =
          (data[leftIndex] + data[leftIndex + 1] + data[leftIndex + 2]) / 3;
        const topGray =
          (data[topIndex] + data[topIndex + 1] + data[topIndex + 2]) / 3;
        const gradientScore =
          Math.abs(currentGray - leftGray) + Math.abs(currentGray - topGray);

        focusScoreTotal += gradientScore;
        if (isCenterPixel) {
          centerFocusScoreTotal += gradientScore;
        }

        const subjectLikePixel =
          (saturation >= 0.2 && currentGray >= 35 && currentGray <= 235) ||
          (green > red + 8 && green > blue + 8);

        if (subjectLikePixel) {
          totalSubjectPixelCount += 1;
          if (isCenterPixel) {
            centerSubjectPixelCount += 1;
          }
        }
      }
    }
  }

  const averageBrightness = pixelCount > 0 ? brightnessTotal / pixelCount : 0;
  const averageFocusScore = pixelCount > 0 ? focusScoreTotal / pixelCount : 0;
  const centerFocusScore = centerPixelCount > 0 ? centerFocusScoreTotal / centerPixelCount : 0;
  const darkRatio = pixelCount > 0 ? darkPixelCount / pixelCount : 0;
  const brightRatio = pixelCount > 0 ? brightPixelCount / pixelCount : 0;
  const lowContrastRatio = pixelCount > 0 ? lowContrastPixelCount / pixelCount : 0;
  const saturationRatio = pixelCount > 0 ? saturatedPixelCount / pixelCount : 0;
  const centerSubjectRatio =
    centerPixelCount > 0 ? centerSubjectPixelCount / centerPixelCount : 0;
  const totalSubjectRatio =
    pixelCount > 0 ? totalSubjectPixelCount / pixelCount : 0;

  const blurIsGood = averageFocusScore >= 14 && centerFocusScore >= 18;
  const lightingIsGood =
    averageBrightness >= 75 &&
    averageBrightness <= 205 &&
    darkRatio <= 0.32 &&
    brightRatio <= 0.2 &&
    (saturationRatio >= 0.12 || lowContrastRatio <= 0.72);
  const distanceIsGood =
    centerSubjectRatio >= 0.18 ||
    (centerSubjectRatio >= 0.12 && totalSubjectRatio >= 0.22);

  return {
    blur: blurIsGood
      ? {
          label: "Blur",
          isGood: true,
          title: "Image looks clear",
          description: "The center of the photo looks sharp enough for analysis.",
        }
      : {
          label: "Blur",
          isGood: false,
          title: "Image may be blurry",
          description: "Try holding the camera still or refocusing before scanning for better results.",
        },
    lighting: lightingIsGood
      ? {
          label: "Lighting",
          isGood: true,
          title: "Lighting looks balanced",
          description: "The image is not too dark or too bright for a first scan.",
        }
      : {
          label: "Lighting",
          isGood: false,
          title: "Lighting may affect the result",
          description: "Try a brighter area or avoid harsh shadows and glare for better results.",
        },
    distance: distanceIsGood
      ? {
          label: "Distance",
          isGood: true,
          title: "Plant fills the frame well",
          description: "The plant looks large enough in the image for analysis.",
        }
      : {
          label: "Distance",
          isGood: false,
          title: "Plant may be too far away",
          description: "Move closer so the leaf takes up more of the photo for better results.",
        },
  };
}
