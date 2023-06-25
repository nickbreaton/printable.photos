import { db } from "../main";

export type PhotoId = `photo-${string}`;

export interface Photo {
  id: PhotoId;
  // projectId: ProjectId
  name: string;
  aspectRatio: number;
  width: number;
  unit: "inches";
  createdAt: Date;
}
