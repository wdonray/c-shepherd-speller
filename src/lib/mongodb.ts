/**
 * MongoDB Connection Manager
 *
 * This module provides a connection management system for MongoDB using Mongoose.
 * It implements connection pooling and caching to optimize database performance
 * and prevent multiple connections to the database.
 *
 * Features:
 * - Connection caching to avoid multiple connections
 * - Connection pooling for better performance (optional)
 * - Environment-based configuration
 * - Error handling and retry logic
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME!;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

if (!MONGODB_DB_NAME) {
  throw new Error(
    "Please define the MONGODB_DB_NAME environment variable inside .env.local"
  );
}

// Define a cached connection interface to avoid multiple connections to the database
interface CachedConnection {
  conn: typeof mongoose | null; // The cached connection
  promise: Promise<typeof mongoose> | null; // The promise to connect to the database
}

// Extend global to include mongoose
declare global {
  var mongoose: CachedConnection | undefined;
}

// Define a cached connection to avoid multiple connections to the database
const cached: CachedConnection = global.mongoose || {
  conn: null,
  promise: null,
};

// If the global mongoose is not defined, set it to the cached connection
if (!global.mongoose) {
  global.mongoose = cached;
}

const opts = {
  bufferCommands: false,
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || "10"),
  serverSelectionTimeoutMS: parseInt(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || "5000"
  ),
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || "45000"),
};

export default async function connectDB() {
  if (cached.conn) return cached.conn; // If the connection is already established, return it

  // If the promise is not defined, connect to the database
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  // Try to connect to the database
  try {
    cached.conn = await cached.promise; // Set the connection to the cached connection
  } catch (e) {
    cached.promise = null; // If the connection fails, set the promise to null
    throw e; // Throw the error
  }

  return cached.conn; // Return the connection
}
