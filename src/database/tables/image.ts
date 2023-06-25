import { db } from "../main";
import { PhotoId } from "./photo";

export type ImageId = `image-${string}`;

export type Image = { id: ImageId; photoId: PhotoId; blob: Blob } & (
  | { type: "source" }
  | { type: "scaled"; devicePixelRatio: number }
);

export const getSourceImage = async (photoId: PhotoId) => {
  const image = await db.images.where({ photoId, type: "source" }).first();
  return { src: URL.createObjectURL(image!.blob), blob: image!.blob };
};
