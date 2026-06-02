import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DBNAME;
const dbMaxPoolSize = +process.env.MONGODB_MAX_POOL_SIZE || 20;


if (!dbName) {
  throw new Error(
    "Please define the MONGODB_DBNAME environment variable inside .env"
  );
}

if (!uri) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env"
  );
}

const globalForMongo = globalThis as unknown as {
  cachedClient: MongoClient | null;
  cachedDb: Db | null;
};

async function connectWithNewClient() {
  const client = await MongoClient.connect(uri, {
    maxIdleTimeMS: 60000, // 60 seconds
    maxPoolSize: dbMaxPoolSize,
    socketTimeoutMS: 30000, // 30 seconds
    connectTimeoutMS: 30000, // 30 seconds
    serverSelectionTimeoutMS: 10000, // 10 seconds
    minPoolSize: 1,
  });
  const db = client.db(dbName);

  // Clear cache if this client closes (e.g. server idle timeout) so we reconnect next time
  client.on("close", () => {
    globalForMongo.cachedClient = null;
    globalForMongo.cachedDb = null;
  });

  globalForMongo.cachedClient = client;
  globalForMongo.cachedDb = db;
  console.log("New MongoDB connection created");
  return { client, db };
}

export default async function connectMongoDB() {
  const client = globalForMongo.cachedClient;
  const db = globalForMongo.cachedDb;

  if (client && db) {
    try {
      // Verify the connection is still alive
      await db.command({ ping: 1 });
      console.log("Using cached connection");
      return { client, db };
    } catch {
      // Stale connection; clear and reconnect
      globalForMongo.cachedClient = null;
      globalForMongo.cachedDb = null;
      try {
        await client.close();
      } catch (error) {
        console.error("Error closing cached connection", error);
      }
    }
  }

  return connectWithNewClient();
}

export async function disconnectFromDatabase() {
  const client = globalForMongo.cachedClient;
  if (client) {
    await client.close();
    globalForMongo.cachedClient = null;
    globalForMongo.cachedDb = null;
  }
}
