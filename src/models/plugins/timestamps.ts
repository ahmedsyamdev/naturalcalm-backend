import { Schema } from 'mongoose';

/**
 * Timestamps plugin for Mongoose schemas
 * Adds automatic createdAt, updatedAt, and deletedAt fields
 */
export function timestampsPlugin<
  DocType = unknown,
  M = unknown,
  TInstanceMethods = Record<string, never>,
  TQueryHelpers = Record<string, never>,
  TVirtuals = Record<string, never>,
  TStaticMethods = Record<string, never>
>(
  schema: Schema<DocType, M, TInstanceMethods, TQueryHelpers, TVirtuals, TStaticMethods>,
  _opts?: unknown
): void {
  // Add timestamp fields
  schema.add({
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // Update updatedAt on save
  schema.pre('save', function (next) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).updatedAt = new Date();
    next();
  });

  // Update updatedAt on findOneAndUpdate and update operations
  schema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
  });

  schema.pre('updateOne', function (next) {
    this.set({ updatedAt: new Date() });
    next();
  });

  schema.pre('updateMany', function (next) {
    this.set({ updatedAt: new Date() });
    next();
  });

  // Add soft delete method
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (schema.methods as any).softDelete = function () {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).deletedAt = new Date();
    return this.save();
  };

  // Add restore method (undo soft delete)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (schema.methods as any).restore = function () {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).deletedAt = null;
    return this.save();
  };

  // Add query helper to exclude soft-deleted documents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (schema.query as any).notDeleted = function () {
    return this.where({ deletedAt: null });
  };

  // Add static method to find non-deleted documents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (schema.statics as any).findNotDeleted = function (conditions = {}) {
    return this.find({ ...conditions, deletedAt: null });
  };
}

export default timestampsPlugin;
