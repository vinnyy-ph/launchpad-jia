import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";

export async function GET(request: Request) {
    try {
        const { db } = await connectMongoDB();
        const testimonials = await db.collection("feedback")
        .aggregate([
            {
                $match: {
                    allowTestimonial: true,
                }
            },
            {
                $lookup: {
                  from: "interviews",
                  localField: "interviewID",
                  foreignField: "interviewID",
                  as: "interviewDetails",
                },
            },
            {
                $unwind: {
                  path: "$interviewDetails",
                  preserveNullAndEmptyArrays: false,
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $limit: 20,
            }
        ])
        .toArray();

        return NextResponse.json(testimonials);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch testimonials" }, { status: 500 });
    }

}