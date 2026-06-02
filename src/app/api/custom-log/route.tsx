import { NextRequest, NextResponse } from "next/server";
import moment from "moment";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { data } = body;

    // Validate that data is provided
    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: "Data is required",
        },
        { status: 400 }
      );
    }

    // Validate required fields for upsert logic
    if (!data.interviewID || !data.name) {
      return NextResponse.json(
        {
          success: false,
          message: "interviewID and name are required for logging",
        },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectMongoDB();
    const collection = db.collection("jia-error-trace");

    // Check if entry exists with matching interviewID and name
    const existingEntry = await collection.findOne({
      interviewID: data.interviewID,
      name: data.name,
    });

    const currentTimestamp = new Date();
    const currentLogDate = moment().format("MMM D YYYY HH:mm:ss");

    if (existingEntry) {
      // Update existing entry: increment count and update last occurrence timestamp
      const updateResult = await collection.updateOne(
        {
          interviewID: data.interviewID,
          name: data.name,
        },
        {
          $inc: { count: 1 },
          $set: {
            lastOccurrence: currentTimestamp,
            lastLogDate: currentLogDate,
            updatedAt: currentTimestamp,
            // Update with latest error details
            errCode: data.errCode,
            errTrace: data.errTrace,
          },
        }
      );

      console.log(
        `Updated existing log entry for ${data.name} in interview ${
          data.interviewID
        }. New count: ${existingEntry.count + 1}`
      );

      return NextResponse.json({
        success: true,
        message: "Existing log entry updated successfully",
        action: "updated",
        count: existingEntry.count + 1,
        timestamp: currentTimestamp.toISOString(),
      });
    } else {
      // Insert new entry
      const newLogData = {
        ...data,
        logTag: "jia-custom-log",
        logDate: currentLogDate,
        lastLogDate: currentLogDate,
        count: 1,
        firstOccurrence: currentTimestamp,
        lastOccurrence: currentTimestamp,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      };

      const insertResult = await collection.insertOne(newLogData);

      console.log(
        `Created new log entry for ${data.name} in interview ${data.interviewID}`
      );

      return NextResponse.json({
        success: true,
        message: "New log entry created successfully",
        action: "created",
        count: 1,
        timestamp: currentTimestamp.toISOString(),
      });
    }
  } catch (error) {
    console.error("Error saving custom log data:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to log data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
