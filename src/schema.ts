import { Schema } from "effect";

import type { CropCoordinates } from "./data";

export class ImageImportError extends Schema.TaggedErrorClass<ImageImportError>()("ImageImportError", {
  fileName: Schema.String,
  cause: Schema.Defect,
}) {}

export class DatabaseWriteError extends Schema.TaggedErrorClass<DatabaseWriteError>()("DatabaseWriteError", {
  cause: Schema.Defect,
}) {}

export class OptimizeImageCanvasContextError extends Schema.TaggedErrorClass<OptimizeImageCanvasContextError>()(
  "OptimizeImageCanvasContextError",
  {},
) {}

export class OptimizeImageBlobError extends Schema.TaggedErrorClass<OptimizeImageBlobError>()(
  "OptimizeImageBlobError",
  {},
) {}

export const CropCoordinatesSchema: Schema.Codec<CropCoordinates> = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
});

export const NonNegativeNumberSchema = Schema.Number.check(Schema.isGreaterThanOrEqualTo(0));

export const StoredProjectImageSchema = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  order: Schema.Number,
  name: Schema.String,
  type: Schema.String,
  width: NonNegativeNumberSchema,
  height: NonNegativeNumberSchema,
  optimizedBlob: Schema.optionalKey(Schema.instanceOf(Blob)),
  crops: Schema.Record(Schema.String, CropCoordinatesSchema),
  createdAt: Schema.DateTimeUtcFromMillis,
  updatedAt: Schema.DateTimeUtcFromMillis,
});

export const OriginalProjectImageSchema = Schema.Struct({
  imageId: Schema.String,
  blob: Schema.instanceOf(Blob),
});

export const ImportedImageSchema = Schema.Struct({
  image: StoredProjectImageSchema,
  originalImage: OriginalProjectImageSchema,
});

export type ImportedImage = Schema.Codec.Encoded<typeof ImportedImageSchema>;
