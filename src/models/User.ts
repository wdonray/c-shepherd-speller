/**
 * User Model for Users
 *
 * This module defines the User schema for users who use the C-Shepherd Speller
 * application. Uses basic information from Google authentication.
 *
 * Features:
 * - User authentication via Google OAuth
 * - Basic profile management
 * - Last active date tracking
 * - Created and updated timestamps
 */

import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  email: string
  name: string
  image?: string
  lastActive: Date
  createdAt: Date
  updatedAt: Date
  words: string[]
  sounds: string[]
  spelling: string[]
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    words: {
      type: [String],
      default: [],
    },
    sounds: {
      type: [String],
      default: [],
    },
    spelling: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for better query performance
UserSchema.index({ lastActive: -1 })

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
