import { Schema, model, Model, Document, Query, QueryWithHelpers } from 'mongoose';

// UserFavorite document interface
export interface IUserFavorite extends Document {
  userId: Schema.Types.ObjectId;
  trackId?: Schema.Types.ObjectId;
  programId?: Schema.Types.ObjectId;
  type: 'track' | 'program';
  createdAt: Date;
}

// Query helper types for UserFavorite
interface IUserFavoriteQueryHelpers {
  byUser(userId: string): QueryWithHelpers<IUserFavorite[], IUserFavorite, IUserFavoriteQueryHelpers>;
  tracks(): QueryWithHelpers<IUserFavorite[], IUserFavorite, IUserFavoriteQueryHelpers>;
  programs(): QueryWithHelpers<IUserFavorite[], IUserFavorite, IUserFavoriteQueryHelpers>;
}

// UserFavorite model interface with static methods
interface IUserFavoriteModel extends Model<IUserFavorite, IUserFavoriteQueryHelpers> {
  findUserTracks(userId: string): Query<IUserFavorite[], IUserFavorite>;
  findUserPrograms(userId: string): Query<IUserFavorite[], IUserFavorite>;
  isFavorited(userId: string, itemId: string, type: 'track' | 'program'): Promise<boolean>;
  checkMultipleFavorites(
    userId: string,
    itemIds: string[],
    type: 'track' | 'program'
  ): Promise<Record<string, boolean>>;
}

// UserFavorite schema
const UserFavoriteSchema = new Schema<IUserFavorite, IUserFavoriteModel, Record<string, never>, IUserFavoriteQueryHelpers>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      // Note: userId is indexed via compound indexes below
    },
    trackId: {
      type: Schema.Types.ObjectId,
      ref: 'Track',
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
    },
    type: {
      type: String,
      required: [true, 'Favorite type is required'],
      enum: {
        values: ['track', 'program'],
        message: '{VALUE} is not a valid favorite type',
      },
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// Compound unique indexes
// Ensure a user can only favorite a specific track once
UserFavoriteSchema.index(
  { userId: 1, trackId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { trackId: { $exists: true } },
  }
);

// Ensure a user can only favorite a specific program once
UserFavoriteSchema.index(
  { userId: 1, programId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { programId: { $exists: true } },
  }
);

// Compound index for efficient queries
UserFavoriteSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Validation: Ensure either trackId or programId is present (not both, not neither)
UserFavoriteSchema.pre('validate', function (next) {
  const hasTrack = !!this.trackId;
  const hasProgram = !!this.programId;

  if (hasTrack && hasProgram) {
    return next(
      new Error('A favorite cannot have both trackId and programId')
    );
  }

  if (!hasTrack && !hasProgram) {
    return next(
      new Error('A favorite must have either trackId or programId')
    );
  }

  // Ensure type matches the provided ID
  if (this.type === 'track' && !hasTrack) {
    return next(
      new Error('Type is "track" but trackId is missing')
    );
  }

  if (this.type === 'program' && !hasProgram) {
    return next(
      new Error('Type is "program" but programId is missing')
    );
  }

  next();
});

// Query helpers
UserFavoriteSchema.query.byUser = function (this: QueryWithHelpers<IUserFavorite[], IUserFavorite, IUserFavoriteQueryHelpers>, userId: string) {
  return this.where({ userId });
};

UserFavoriteSchema.query.tracks = function (this: QueryWithHelpers<IUserFavorite[], IUserFavorite, IUserFavoriteQueryHelpers>) {
  return this.where({ type: 'track' });
};

UserFavoriteSchema.query.programs = function (this: QueryWithHelpers<IUserFavorite[], IUserFavorite, IUserFavoriteQueryHelpers>) {
  return this.where({ type: 'program' });
};

// Static methods
UserFavoriteSchema.statics.findUserTracks = function (userId: string) {
  return this.find({ userId, type: 'track' })
    .populate('trackId')
    .sort({ createdAt: -1 });
};

UserFavoriteSchema.statics.findUserPrograms = function (userId: string) {
  return this.find({ userId, type: 'program' })
    .populate('programId')
    .sort({ createdAt: -1 });
};

UserFavoriteSchema.statics.isFavorited = async function (
  userId: string,
  itemId: string,
  type: 'track' | 'program'
): Promise<boolean> {
  const query =
    type === 'track'
      ? { userId, trackId: itemId, type }
      : { userId, programId: itemId, type };

  const favorite = await this.findOne(query);
  return !!favorite;
};

UserFavoriteSchema.statics.checkMultipleFavorites = async function (
  userId: string,
  itemIds: string[],
  type: 'track' | 'program'
): Promise<Record<string, boolean>> {
  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  const fieldName = type === 'track' ? 'trackId' : 'programId';
  const query = {
    userId,
    [fieldName]: { $in: itemIds },
    type,
  };

  const favorites = await this.find(query).select(fieldName);

  const favoriteMap: Record<string, boolean> = {};
  itemIds.forEach((id) => {
    favoriteMap[id] = false;
  });

  favorites.forEach((fav) => {
    const field = type === 'track' ? fav.trackId : fav.programId;
    if (field) {
      const itemId = (field as Schema.Types.ObjectId).toString();
      if (itemId) {
        favoriteMap[itemId] = true;
      }
    }
  });

  return favoriteMap;
};

// Create and export the UserFavorite model
export const UserFavorite = model<IUserFavorite, IUserFavoriteModel>(
  'UserFavorite',
  UserFavoriteSchema
);

export default UserFavorite;
