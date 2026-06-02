import { MongoClient } from "mongodb";

// Helper function to connect to a specific database
async function connectToDatabase(dbName: string) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env"
    );
  }

  const client = await MongoClient.connect(uri, {});
  const db = client.db(dbName);
  return { client, db };
}

// Helper function to create ASCII progress bar
function createProgressBar(
  current: number,
  total: number,
  width: number = 50
): string {
  const percentage = Math.min(100, Math.round((current / total) * 100));
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}] ${percentage}% (${current}/${total})`;
}

// Helper function to log progress with progress bar
function logProgress(
  collectionName: string,
  current: number,
  total: number,
  documentsCopied: number
) {
  const progressBar = createProgressBar(current, total);
  console.log(
    `\n${progressBar}\nCollection: ${collectionName}\nDocuments copied: ${documentsCopied}\n${"=".repeat(
      60
    )}`
  );
}

export async function GET(request: Request) {
  try {
    // Validate that the request is coming from localhost
    const origin = request.headers.get("origin") || request.headers.get("host");
    const isLocalhost =
      origin?.includes("localhost") ||
      origin?.includes("127.0.0.1") ||
      origin?.includes("::1");

    if (!isLocalhost) {
      return Response.json(
        {
          error: "Access denied",
          message: "This endpoint is only accessible from localhost",
          origin: origin,
        },
        { status: 403 }
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("Starting database copy operation...");
    console.log("Source: jia-db");
    console.log("Destination: jia-staging-db");
    console.log("=".repeat(60) + "\n");

    // Connect to source and destination databases
    const { client: sourceClient, db: sourceDb } = await connectToDatabase(
      "jia-db"
    );
    const { client: destClient, db: destDb } = await connectToDatabase(
      "jia-staging-db"
    );

    try {
      // Get all collection names from source database
      const collections = await sourceDb.listCollections().toArray();
      const collectionNames = collections
        .map((col) => col.name)
        .filter((name) => !name.startsWith("system."));

      console.log(`Found ${collectionNames.length} collections to copy\n`);

      const copyResults: any[] = [];
      let totalDocumentsCopied = 0;

      // Copy each collection
      for (let i = 0; i < collectionNames.length; i++) {
        const collectionName = collectionNames[i];
        console.log(
          `\nProcessing collection ${i + 1}/${
            collectionNames.length
          }: ${collectionName}`
        );

        try {
          // Get all documents from source collection
          const documents = await sourceDb
            .collection(collectionName)
            .find({})
            .toArray();

          if (documents.length === 0) {
            console.log(
              `  ⚠️  Collection ${collectionName} is empty, skipping...`
            );
            copyResults.push({
              collection: collectionName,
              status: "skipped",
              documentsCopied: 0,
              error: null,
            });
            continue;
          }

          // Drop destination collection if it exists (to ensure clean copy)
          try {
            await destDb.collection(collectionName).drop();
            console.log(`  🗑️  Dropped existing collection: ${collectionName}`);
          } catch (error: any) {
            // Ignore error if collection doesn't exist
            if (error.codeName !== "NamespaceNotFound") {
              console.log(`  ⚠️  Could not drop collection: ${error.message}`);
            }
          }

          // Insert documents into destination collection in batches
          const batchSize = 1000;
          let documentsCopied = 0;

          for (let j = 0; j < documents.length; j += batchSize) {
            const batch = documents.slice(j, j + batchSize);
            await destDb.collection(collectionName).insertMany(batch, {
              ordered: false,
            });
            documentsCopied += batch.length;
            totalDocumentsCopied += batch.length;

            // Show progress for large collections
            if (documents.length > batchSize) {
              const progressBar = createProgressBar(
                documentsCopied,
                documents.length
              );
              process.stdout.write(`\r  ${progressBar} - ${collectionName}`);
            }
          }

          // Clear the progress line
          if (documents.length > batchSize) {
            process.stdout.write("\r" + " ".repeat(80) + "\r");
          }

          console.log(
            `  ✅ Copied ${documentsCopied} documents from ${collectionName}`
          );

          // Log overall progress
          logProgress(
            collectionName,
            i + 1,
            collectionNames.length,
            documentsCopied
          );

          copyResults.push({
            collection: collectionName,
            status: "success",
            documentsCopied: documentsCopied,
            error: null,
          });
        } catch (error: any) {
          console.error(
            `  ❌ Error copying collection ${collectionName}:`,
            error.message
          );
          copyResults.push({
            collection: collectionName,
            status: "error",
            documentsCopied: 0,
            error: error.message,
          });
        }
      }

      // Final summary
      const successful = copyResults.filter(
        (r) => r.status === "success"
      ).length;
      const failed = copyResults.filter((r) => r.status === "error").length;
      const skipped = copyResults.filter((r) => r.status === "skipped").length;

      console.log("\n" + "=".repeat(60));
      console.log("Database copy operation completed!");
      console.log("=".repeat(60));
      console.log(`Total collections processed: ${collectionNames.length}`);
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`⚠️  Skipped (empty): ${skipped}`);
      console.log(
        `📄 Total documents copied: ${totalDocumentsCopied.toLocaleString()}`
      );
      console.log("=".repeat(60) + "\n");

      return Response.json({
        message: "Database copy completed",
        summary: {
          totalCollections: collectionNames.length,
          successful,
          failed,
          skipped,
          totalDocumentsCopied,
        },
        results: copyResults,
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Close database connections
      await sourceClient.close();
      await destClient.close();
      console.log("Database connections closed.\n");
    }
  } catch (error) {
    console.error("Error copying database:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
