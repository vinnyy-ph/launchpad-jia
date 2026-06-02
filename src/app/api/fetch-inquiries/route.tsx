import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import moment from "moment";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const companySizeFilters = searchParams.get("companySizeFilters") || "";
    const reasonForInquiryFilters = searchParams.get("reasonForInquiryFilters") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const { db } = await connectMongoDB();

    let filter: any = {};

    if (search.length > 0) {
        filter = {
            ...filter,
            $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { companyName: { $regex: search, $options: "i" } },
            ]
        };
    }

    if (startDate && endDate) {
        filter.createdAt = {
            $gte: moment(startDate).utcOffset(8).startOf("day").toDate(),
            $lte: moment(endDate).utcOffset(8).endOf("day").toDate()
        };
    }

    if (companySizeFilters.length > 0) {
        filter.companySize = { $in: companySizeFilters.split(",") };
    }
    if (reasonForInquiryFilters.length > 0) {
        filter.reasonForInquiry = { $in: reasonForInquiryFilters.split(",") };
    }

    const inquiries = await db
      .collection("inquiries")
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const totalInquiries = await db.collection("inquiries").countDocuments(filter);

    return NextResponse.json({inquiries, totalInquiries});
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch inquiries" },
      { status: 500 }
    );
  }
});