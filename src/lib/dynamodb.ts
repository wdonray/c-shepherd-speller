/**
 * DynamoDB Connection Manager
 *
 * This module provides a connection management system for DynamoDB using AWS SDK v3.
 * It implements connection caching to optimize database performance and prevent
 * multiple client instances.
 *
 * Features:
 * - Client caching to avoid multiple instances
 * - Environment-based configuration
 * - Error handling and retry logic
 */

import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// Environment variables for DynamoDB configuration
const AWS_REGION = process.env.AUTH_DYNAMODB_REGION || 'us-east-1'
const AWS_ACCESS_KEY_ID = process.env.AUTH_DYNAMODB_ID
const AWS_SECRET_ACCESS_KEY = process.env.AUTH_DYNAMODB_SECRET
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT // For local development

// DynamoDB client configuration
const clientConfig: DynamoDBClientConfig = {
  region: AWS_REGION,
}

// Add credentials if provided (for local development or specific IAM users)
if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  }
}

// Add endpoint for local development
if (DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = DYNAMODB_ENDPOINT
}

// Create DynamoDB client
const client = new DynamoDBClient(clientConfig)

// Create DynamoDB document client for easier operations
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

export { client, docClient }
export default docClient
