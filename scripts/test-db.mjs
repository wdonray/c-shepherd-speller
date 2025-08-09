// This is an ES module
import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...')

    await mongoose.connect(process.env.MONGODB_URI)
    console.log('✅ MongoDB connected successfully!')

    // Test database operations
    const db = mongoose.connection.db
    const collections = await db.listCollections().toArray()
    console.log(
      '📁 Available collections:',
      collections.map((c) => c.name)
    )

    await mongoose.disconnect()
    console.log('✅ Connection test completed successfully!')
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

testConnection()
