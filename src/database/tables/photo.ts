import { Unit } from "../common";
import { ProjectId } from "./project";

export type PhotoId = `photo-${string}`;

export interface Photo {
  id: PhotoId;
  projectId: ProjectId;
  name: string;
  aspectRatio: number;
  width: number;
  unit: Unit;
  createdAt: Date;
}
