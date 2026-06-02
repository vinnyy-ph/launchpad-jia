import { NextResponse } from "next/server";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import moment from "moment";

class JobMetrics {
    careerId?: string;
    orgID?: string;
    isActiveCareer: boolean;
    newApplicants: number;
    averageTimeToHire: number;
    hiredApplicantCount: number;
    jobOffersCount: number;
    finalInterviewEndorsementCount: number;
    newHireCount: number;
    offerAcceptanceRate: number;
    createdAt: Date;
}

export async function GET(request: Request) {
    try {
        const { db } = await connectMongoDB();
        const careers = await db.collection("careers").find({}).toArray();
        const bulkMetrics = [];
        const currentDate = moment().startOf("day").toDate();
        for (const career of careers) {
            const previousDayMetrics = await db.collection("recruiter-metrics").find({ 
                careerId: career._id.toString(), 
                createdAt: { $gte: moment().subtract(1, "day").startOf("day").toDate(), $lt: currentDate } 
            })
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();
            const previousMetrics: JobMetrics = previousDayMetrics.length > 0 
                ? (previousDayMetrics[0] as unknown as JobMetrics) 
                : {
                    isActiveCareer: false,
                    newApplicants: 0,
                    averageTimeToHire: 0,
                    hiredApplicantCount: 0,
                    jobOffersCount: 0,
                    finalInterviewEndorsementCount: 0,
                    newHireCount: 0,
                    offerAcceptanceRate: 0,
                    createdAt: new Date(),
                };
            let averageTimeToHire = 0;
            // Get new Hired interviews start from today
            const hiredInterviews = await db.collection("interviews").find({ 
                id: career.id, 
                applicationStatus: "Hired",
                "applicationMetadata.updatedAt": { $gte: currentDate.getTime() }
            }).toArray();
            if (hiredInterviews.length > 0) {
                const jobCreationDate = new Date(career.createdAt);
                for (const hiredInterview of hiredInterviews) {
                    const hiredDate = new Date(hiredInterview.applicationMetadata?.updatedAt || hiredInterview.updatedAt);
                    const timeToHire = hiredDate.getTime() - jobCreationDate.getTime();
                    averageTimeToHire += timeToHire;
                }
                // Convert to days
                averageTimeToHire = (averageTimeToHire / hiredInterviews.length) / 86400000;
            }

            if (previousMetrics.averageTimeToHire > 0 && previousMetrics.hiredApplicantCount > 0) {
                // Average with previous metrics
                averageTimeToHire = (previousMetrics.averageTimeToHire * previousMetrics.hiredApplicantCount + averageTimeToHire * hiredInterviews.length) / (previousMetrics.hiredApplicantCount + hiredInterviews.length);
            }
            
            // Find all job offers for the career
            let offerAcceptanceRate = 0;
            const jobOffers = await db.collection("interview-history").countDocuments({ 
                    careerId: career._id.toString(),
                    $or: [
                        { toStage: "Job Offer: Waiting Offer Acceptance" },
                        { toStage: "Job Offered"}
                    ],
                    createdAt: { $gte: currentDate.getTime() }
            });
            const totalHired = hiredInterviews.length + previousMetrics.hiredApplicantCount;
            const totalJobOffers = jobOffers + previousMetrics.jobOffersCount;
            if (totalJobOffers <= totalHired && totalHired > 0) {
                offerAcceptanceRate = 100;
            } else if (totalJobOffers > 0) {
                offerAcceptanceRate = (totalHired / totalJobOffers) * 100;
            }

            // New applications TODAY
            const newApplicants = await db.collection("interviews").countDocuments({ 
                id: career.id,
                createdAt: { $gte: currentDate }
            });
            // Final Interview Endorsement Count TODAY
            const finalInterviewEndorsementCount = await db.collection("interview-history").aggregate([
            { 
                $match: {
                    careerId: career._id.toString(),
                    toStageId: "3",
                    createdAt: { $gte: currentDate.getTime() }
                }
            },
            {
                $group: {
                    _id: "$interviewUID",
                }
            }
            ]).toArray();
            const metrics: JobMetrics = {
                careerId: career._id.toString(),
                orgID: career.orgID,
                isActiveCareer: career.status === "active",
                newApplicants: newApplicants,
                averageTimeToHire,
                hiredApplicantCount: hiredInterviews.length + previousMetrics.hiredApplicantCount,
                offerAcceptanceRate: offerAcceptanceRate,
                jobOffersCount: jobOffers + previousMetrics.jobOffersCount,
                finalInterviewEndorsementCount: finalInterviewEndorsementCount.length,
                newHireCount: hiredInterviews.length,
                createdAt: new Date(),
            }
            bulkMetrics.push(metrics);
        }
        if (bulkMetrics.length > 0) {
            await db.collection("recruiter-metrics").insertMany(bulkMetrics);
        }
        return NextResponse.json({ message: "Recruiter metrics saved successfully" }, { status: 200 });
    } catch (error) {
        console.error("Error saving recruiter metrics:", error);
        return NextResponse.json({ error: "Error saving recruiter metrics" }, { status: 500 });
    }
}