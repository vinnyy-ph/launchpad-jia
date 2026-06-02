import { MongoClient } from "mongodb";
import { vectorizeCandidates } from "./candidate-vectorizer";

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

export async function GET(request: Request) {
  try {
    // Validate that the request is coming from localhost
    const { searchParams } = new URL(request.url);
    const task = searchParams.get("task");

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

    if (task === "vectorize-candidates") {
      const candidates = await vectorizeCandidates();
      return Response.json({
        message: "Candidates vectorized successfully",
        count: candidates.length,
        data: candidates,
        timestamp: new Date().toISOString(),
      });
    }

    if (task === "data-stats") {
      const dbName = process.env.MONGODB_DBNAME || "test";
      const { client, db } = await connectToDatabase(dbName);
      try {
        const [
          totalInterviews,
          totalCVs,
          totalTranscripts,
          uniqueInterviewIDs,
          totalApplicants,
        ] = await Promise.all([
          db.collection("interviews").countDocuments(),
          db.collection("applicant-cv").countDocuments(),
          db.collection("transcripts").countDocuments(),
          db.collection("transcripts").distinct("interviewID"),
          db.collection("applicants").countDocuments(),
        ]);

        return Response.json({
          message: "Data statistics retrieved successfully",
          stats: {
            totalInterviews,
            totalCVs,
            totalTranscripts,
            uniqueInterviewIDs: uniqueInterviewIDs.length,
            totalApplicants,
          },
          timestamp: new Date().toISOString(),
        });
      } finally {
        await client.close();
      }
    }

    // Default: Connect to database to get version
    const { client, db } = await connectToDatabase("admin");

    try {
      const buildInfo = await db.command({ buildInfo: 1 });
      const version = buildInfo.version;

      return Response.json({
        message: "MongoDB version retrieved successfully",
        version: version,
        details: buildInfo,
        timestamp: new Date().toISOString(),
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error("Error in data-worker:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
