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
  const imageAspectRatio = imageWidth / imageHeight;
  const cropAspectRatio = getCropAspectRatio(currentCrop);
  const viewBoxWidth = getImageViewBoxWidth(imageWidth, imageHeight);
  const widthPercent = Math.min(cropAspectRatio / imageAspectRatio, 1);
  const heightPercent = Math.min(imageAspectRatio / cropAspectRatio, 1);
  const width = widthPercent * viewBoxWidth;
  const height = heightPercent * 100;
  return {
    x: (viewBoxWidth - width) / 2,
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
  const viewBoxWidth = getImageViewBoxWidth(imageWidth, imageHeight);
  return {
    x: (crop.x / viewBoxWidth) * 100,
    y: crop.y,
    width: (crop.width / viewBoxWidth) * 100,
    height: crop.height,
  };
}

export function cropFromPercentages(
  crop: CropPercentages,
  imageWidth: number,
  imageHeight: number,
): CropRect {
  const viewBoxWidth = getImageViewBoxWidth(imageWidth, imageHeight);
  return {
    x: (crop.x / 100) * viewBoxWidth,
    y: crop.y,
    width: (crop.width / 100) * viewBoxWidth,
    height: crop.height,
  };
}

export function cropToSourcePixels(crop: CropRect, imageWidth: number, imageHeight: number) {
  const viewBoxWidth = getImageViewBoxWidth(imageWidth, imageHeight);

  return {
    x: (crop.x / viewBoxWidth) * imageWidth,
    y: (crop.y / 100) * imageHeight,
    width: (crop.width / viewBoxWidth) * imageWidth,
    height: (crop.height / 100) * imageHeight,
  };
}
