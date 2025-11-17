import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// Category document interface
export interface ICategory extends Document {
  name: string;
  nameEn?: string;
  icon: string;
  color: string;
  imageUrl: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Query helper types for Category
interface ICategoryQueryHelpers {
  active(): QueryWithHelpers<ICategory[], ICategory, ICategoryQueryHelpers>;
}

// Category model interface with statics
interface ICategoryModel extends Model<ICategory, ICategoryQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<ICategory>): Query<ICategory[], ICategory>;
  findActiveCategories(): Query<ICategory[], ICategory>;
}

// Category schema
const CategorySchema = new Schema<ICategory, ICategoryModel, Record<string, never>, ICategoryQueryHelpers>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      // Arabic names like التأمل, المسارات, etc.
    },
    nameEn: {
      type: String,
      trim: true,
      // English translation (optional)
    },
    icon: {
      type: String,
      required: [true, 'Category icon is required'],
      // Emoji or icon identifier (e.g., "🧘", "🌊", "🌙")
    },
    color: {
      type: String,
      required: [true, 'Category color is required'],
      // Color gradient classes or hex codes
    },
    imageUrl: {
      type: String,
      required: [true, 'Category image URL is required'],
    },
    description: {
      type: String,
      trim: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      // Lower numbers appear first
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
  }
);

// Apply timestamps plugin
CategorySchema.plugin(timestampsPlugin);

// Indexes
CategorySchema.index({ displayOrder: 1 });
CategorySchema.index({ isActive: 1 });
// Note: name index is automatically created via unique constraint in field definition

// Query helper to get active categories
CategorySchema.query.active = function (this: QueryWithHelpers<ICategory[], ICategory, ICategoryQueryHelpers>) {
  return this.where({ isActive: true });
};

// Static method to get ordered categories
CategorySchema.statics.getOrdered = function () {
  return this.find({ isActive: true }).sort({ displayOrder: 1 });
};

// Create and export the Category model
export const Category = model<ICategory, ICategoryModel>(
  'Category',
  CategorySchema
);

export default Category;
