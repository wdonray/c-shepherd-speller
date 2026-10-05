/**
 * create-tables.mjs — bootstrap the DynamoDB tables C-Shepherd Speller needs.
 *
 * Creates the app's tables if they do not already exist (idempotent; existing
 * tables are skipped, never replaced):
 *
 *   1. c-shepherd-users (USER_TABLE_NAME) — teacher records.
 *      Partition key PK (S), sort key SK (S),
 *      plus the EmailIndex GSI on `email` (S) used by getUserByEmail.
 *
 *   2. next-auth (AUTH_TABLE_NAME) — the next-auth DynamoDB adapter table.
 *      Partition key pk (S), sort key sk (S),
 *      plus the GSI1 index on GSI1PK (S)/GSI1SK (S) the adapter queries.
 *      (Required by @next-auth/dynamodb-adapter; matches the adapter's defaults.)
 *
 * Connection:
 *   - DYNAMODB_ENDPOINT set  -> DynamoDB Local (e.g. http://localhost:8000).
 *     Start it with: docker run -p 8000:8000 amazon/dynamodb-local
 *     DynamoDB Local accepts any non-empty credentials; DYNAMODB_ENDPOINT is
 *     all it strictly needs, but keep dummy values for the access keys anyway.
 *   - DYNAMODB_ENDPOINT unset -> real AWS, using AUTH_DYNAMODB_REGION/ID/SECRET.
 *
 * Usage: npm run create-tables        (creates missing tables)
 *        npm run create-tables -- --dry-run   (prints the table definitions without touching the DB)
 *
 * Note: if the auth hybrid fix (C1) changes adapter table requirements,
 * this script gets updated in that PR.
 */

import { DynamoDBClient, CreateTableCommand, ListTablesCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb'
import dotenv from 'dotenv'

// Load environment variables (quietly; .env.local is optional)
dotenv.config({ path: '.env.local' })
dotenv.config()

const DRY_RUN = process.argv.includes('--dry-run')

const REGION = process.env.AUTH_DYNAMODB_REGION || 'us-east-1'
const ENDPOINT = process.env.DYNAMODB_ENDPOINT

const USER_TABLE_NAME = process.env.USER_TABLE_NAME || 'c-shepherd-users'
const AUTH_TABLE_NAME = process.env.AUTH_TABLE_NAME || 'next-auth'

/** Table definitions. Keep in sync with the key schemas used in src/. */
const TABLE_DEFINITIONS = [
  {
    TableName: USER_TABLE_NAME,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: AUTH_TABLE_NAME,
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
]

function buildClient() {
  return new DynamoDBClient({
    region: REGION,
    ...(process.env.AUTH_DYNAMODB_ID &&
      process.env.AUTH_DYNAMODB_SECRET && {
        credentials: {
          accessKeyId: process.env.AUTH_DYNAMODB_ID,
          secretAccessKey: process.env.AUTH_DYNAMODB_SECRET,
        },
      }),
    ...(ENDPOINT && { endpoint: ENDPOINT }),
  })
}

async function main() {
  const target = ENDPOINT ? `DynamoDB Local (${ENDPOINT})` : `AWS region ${REGION}`

  if (DRY_RUN) {
    console.log(`--dry-run: table definitions for ${target} (nothing will be created)\n`)
    for (const table of TABLE_DEFINITIONS) {
      console.log(JSON.stringify(table, null, 2))
      console.log()
    }
    return
  }

  console.log(`Creating tables against ${target}...`)
  const client = buildClient()

  try {
    const { TableNames = [] } = await client.send(new ListTablesCommand({}))
    const existing = new Set(TableNames)

    for (const table of TABLE_DEFINITIONS) {
      if (existing.has(table.TableName)) {
        console.log(`- ${table.TableName}: already exists, skipping`)
        continue
      }
      await client.send(new CreateTableCommand(table))
      await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: table.TableName })
      console.log(`- ${table.TableName}: created`)
    }

    console.log('Done.')
  } catch (error) {
    console.error(`Failed to create tables: ${error.message}`)
    if (!ENDPOINT) {
      console.log('Hint: for local development without AWS, run DynamoDB Local:')
      console.log('  docker run -p 8000:8000 amazon/dynamodb-local')
      console.log('then set DYNAMODB_ENDPOINT=http://localhost:8000 in .env.local')
    }
    process.exitCode = 1
  } finally {
    await client.destroy()
  }
}

main()
