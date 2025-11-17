import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  storageType: 'local' | 'r2';
  adminProfile: {
    name: string;
    email: string;
    phone?: string;
  };
  r2Config?: {
    accountId?: string;
    bucketName?: string;
    publicUrl?: string;
    isConfigured: boolean;
  };
  localStoragePath?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    storageType: {
      type: String,
      enum: {
        values: ['local', 'r2'],
        message: '{VALUE} is not a valid storage type',
      },
      default: 'local',
      required: true,
    },
    adminProfile: {
      name: {
        type: String,
        required: [true, 'Admin name is required'],
        trim: true,
      },
      email: {
        type: String,
        required: [true, 'Admin email is required'],
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },
    r2Config: {
      accountId: String,
      bucketName: String,
      publicUrl: String,
      isConfigured: {
        type: Boolean,
        default: false,
      },
    },
    localStoragePath: {
      type: String,
      default: './public/uploads',
    },
  },
  {
    timestamps: true,
  }
);

// Create a singleton pattern - only one settings document should exist
SettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    // Create default settings if none exist
    settings = await this.create({
      storageType: 'local',
      adminProfile: {
        name: 'Admin',
        email: 'admin@naturacalm.com',
      },
      localStoragePath: './public/uploads',
    });
  }
  return settings;
};

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);
