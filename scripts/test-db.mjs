import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

console.log('Testing DynamoDB connection...')

const client = new DynamoDBClient({
  region: process.env.AUTH_DYNAMODB_REGION || 'us-east-1',
  ...(process.env.AUTH_DYNAMODB_ID &&
    process.env.AUTH_DYNAMODB_SECRET && {
      credentials: {
        accessKeyId: process.env.AUTH_DYNAMODB_ID,
        secretAccessKey: process.env.AUTH_DYNAMODB_SECRET,
      },
    }),
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
  }),
})

async function testConnection() {
  try {
    // Test connection by listing tables
    const command = new ListTablesCommand({})
    const result = await client.send(command)

    console.log('✅ DynamoDB connected successfully!')
    console.log('Available tables:', result.TableNames || [])

    // Check if required tables exist
    const requiredTables = [
      process.env.AUTH_TABLE_NAME || 'next-auth',
      process.env.USER_TABLE_NAME || 'c-shepherd-users',
    ]

    const missingTables = requiredTables.filter((table) => !result.TableNames?.includes(table))

    if (missingTables.length > 0) {
      console.log('⚠️  Missing required tables:', missingTables)
      console.log('Please create these tables in your DynamoDB instance')
    } else {
      console.log('✅ All required tables are available')
    }
  } catch (error) {
    console.error('❌ DynamoDB connection failed:', error.message)

    if (error.name === 'CredentialsError') {
      console.log('💡 Make sure your AWS credentials are properly configured')
    } else if (error.name === 'ResourceNotFoundException') {
      console.log('💡 Make sure the DynamoDB table exists')
    }
  } finally {
    await client.destroy()
  }
}

testConnection()
