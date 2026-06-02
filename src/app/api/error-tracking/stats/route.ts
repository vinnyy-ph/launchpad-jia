import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    // Connect to MongoDB
    const { db } = await connectMongoDB();
    const collection = db.collection("jia-error-trace");

    // Get total error count
    const totalErrors = (await collection.countDocuments()) || 0;

    // Get unique error names with their counts
    const errorTypeStats = await collection
      .aggregate([
        {
          $group: {
            _id: "$name",
            count: { $sum: { $ifNull: ["$count", 1] } },
            uniqueOccurrences: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    // Get error count per date for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const errorCountByDate = await collection
      .aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            count: { $sum: { $ifNull: ["$count", 1] } },
            logDate: { $first: "$logDate" }, // Use the actual logDate field from the document
          },
        },
        {
          $sort: { _id: 1 },
        },
      ])
      .toArray();

    // Calculate total count of all error occurrences for percentage calculation
    const totalErrorOccurrences = errorTypeStats.reduce(
      (sum, stat) => sum + (stat.count || 0),
      0
    );

    // Calculate percentages for error types based on total occurrences
    const errorTypeStatsWithPercentages = errorTypeStats.map((stat) => ({
      name: stat._id || "Unknown",
      count: stat.count || 0,
      uniqueOccurrences: stat.uniqueOccurrences || 0,
      percentage:
        totalErrorOccurrences > 0 && stat.count
          ? ((stat.count / totalErrorOccurrences) * 100).toFixed(2)
          : "0.00",
    }));

    // Verify percentages add up to 100%
    const totalPercentage = errorTypeStatsWithPercentages.reduce(
      (sum, stat) => sum + parseFloat(stat.percentage),
      0
    );

    console.log(`Total error occurrences: ${totalErrorOccurrences}`);
    console.log(`Total percentage: ${totalPercentage.toFixed(2)}%`);

    // If percentages don't add up to 100%, adjust the last item to make it exact
    if (
      errorTypeStatsWithPercentages.length > 0 &&
      Math.abs(totalPercentage - 100) > 0.01
    ) {
      const adjustment = 100 - totalPercentage;
      const lastIndex = errorTypeStatsWithPercentages.length - 1;
      const currentPercentage = parseFloat(
        errorTypeStatsWithPercentages[lastIndex].percentage
      );
      errorTypeStatsWithPercentages[lastIndex].percentage = (
        currentPercentage + adjustment
      ).toFixed(2);
      console.log(
        `Adjusted last percentage by ${adjustment.toFixed(
          2
        )}% to ensure 100% total`
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        totalErrors: totalErrors || 0,
        uniqueErrorTypes: (errorTypeStats || []).length,
        errorTypeStats: errorTypeStatsWithPercentages || [],
        errorCountByDate: errorCountByDate || [],
      },
    });
  } catch (error) {
    console.error("Error fetching error tracking statistics:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch error tracking statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
