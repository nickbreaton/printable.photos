import type { Rectangle } from "maxrects-packer";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropPercentages {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getCropAspectRatio(currentCrop: Rectangle) {
  return currentCrop.rot
    ? currentCrop.height / currentCrop.width
    : currentCrop.width / currentCrop.height;
}

export function getCropKey(currentCrop: Rectangle) {
  return getCropAspectRatio(currentCrop).toFixed(6);
}

export function getImageViewBoxWidth(imageWidth: number, imageHeight: number) {
  return 100 * (imageWidth / imageHeight);
}

export function computeInitialCrop(
  imageWidth: number,
  imageHeight: number,
  currentCrop: Rectangle,
): CropRect {
  const imageAR = imageWidth / imageHeight;
  const cropAR = getCropAspectRatio(currentCrop);
  const vbw = getImageViewBoxWidth(imageWidth, imageHeight);
  const widthPercent = Math.min(cropAR / imageAR, 1);
  const heightPercent = Math.min(imageAR / cropAR, 1);
  const width = widthPercent * vbw;
  const height = heightPercent * 100;
  return {
    x: (vbw - width) / 2,
    y: (100 - height) / 2,
    width,
    height,
  };
}

export function cropToPercentages(
  crop: CropRect,
  imageWidth: number,
  imageHeight: number,
): CropPercentages {
  const vbw = getImageViewBoxWidth(imageWidth, imageHeight);
  return {
    x: (crop.x / vbw) * 100,
    y: crop.y,
    width: (crop.width / vbw) * 100,
    height: crop.height,
  };
}

export function cropFromPercentages(
  crop: CropPercentages,
  imageWidth: number,
  imageHeight: number,
): CropRect {
  const vbw = getImageViewBoxWidth(imageWidth, imageHeight);
  return {
    x: (crop.x / 100) * vbw,
    y: crop.y,
    width: (crop.width / 100) * vbw,
    height: crop.height,
  };
}

export function cropToSourcePixels(crop: CropRect, imageWidth: number, imageHeight: number) {
  const vbw = getImageViewBoxWidth(imageWidth, imageHeight);

  return {
    x: (crop.x / vbw) * imageWidth,
    y: (crop.y / 100) * imageHeight,
    width: (crop.width / vbw) * imageWidth,
    height: (crop.height / 100) * imageHeight,
  };
}
