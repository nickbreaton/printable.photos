import { Unit } from "../common";

export type ProjectId = `project-${string}`;

export interface Project {
  id: ProjectId;
  name: string;
  height: number;
  width: number;
  margin: number;
  gap: number;
  unit: Unit;
  createdAt: Date;
}
