import type { Bin, Rectangle } from "maxrects-packer";

export interface PackedImageData {
  id: string;
}

export type PackedImageRectangle = Rectangle & {
  data: PackedImageData;
};

export type PackedImageBin = Bin<PackedImageRectangle>;
