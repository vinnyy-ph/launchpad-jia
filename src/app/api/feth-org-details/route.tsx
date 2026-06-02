import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { orgID } = await request.json();

    if (!orgID) {
      return Response.json(
        { error: "Missing orgID parameter" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Try to convert orgID to ObjectId if possible, else use as string
    let query;
    try {
      query = { _id: new ObjectId(orgID) };
    } catch (e) {
      query = { _id: orgID };
    }

    const orgDoc = await db.collection("organizations").aggregate([
      {
        $match: query
      },
      {
        $lookup: {
          from: "organization-plans",
          let: { creditBasedPlanId: "$creditBasedPlan.planId" },
          pipeline: [
            {
              $addFields: {
                _id: { $toString: "$_id" }
              }
            },
            {
              $match: {
                $expr: { $eq: ["$_id", "$$creditBasedPlanId"] }
              }
            }
          ],
          as: "creditBasedPlanDetails"
        }
      },
      {
        $lookup: {
          from: "organization-plans",
          let: { premiumPlanId: "$premiumPlan.planId" },
          pipeline: [
            {
              $addFields: {
                _id: { $toString: "$_id" }
              }
            },
            {
              $match: {
                $expr: { $eq: ["$_id", "$$premiumPlanId"] }
              }
            }
          ],
          as: "premiumPlanDetails"
        }
      },
    ]).toArray();

    if (!orgDoc || orgDoc.length === 0) {
      return Response.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return Response.json(orgDoc[0]);
  } catch (error) {
    console.error("Error in feth-org-details endpoint:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
