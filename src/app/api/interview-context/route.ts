import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const COLLECTION = "interview-session-context";
const MAX_TRANSCRIPT_TURNS = 20;
const MAX_TEXT_LENGTH = 500;

function truncateText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text.length > MAX_TEXT_LENGTH
    ? text.slice(0, MAX_TEXT_LENGTH) + "..."
    : text;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { searchParams } = new URL(request.url);
  const interviewID = searchParams.get("interviewID");

  if (!interviewID) {
    return NextResponse.json(
      { error: "interviewID is required" },
      { status: 400 }
    );
  }

  const { db } = await connectMongoDB();

  const context = await db
    .collection(COLLECTION)
    .findOne({ interviewID });

  if (!context) {
    return NextResponse.json({ context: null });
  }

  await db.collection(COLLECTION).updateOne(
    { interviewID },
    { $inc: { reconnectCount: 1 }, $set: { updatedAt: Date.now() } }
  );

  context.reconnectCount = (context.reconnectCount || 0) + 1;

  return NextResponse.json({ context });
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const {
    interviewID,
    transcript,
    questionsAsked,
    lastQuestionIndex,
    allQuestions,
    questionsStatus,
  } = await request.json();

  if (!interviewID) {
    return NextResponse.json(
      { error: "interviewID is required" },
      { status: 400 }
    );
  }

  const compactTranscript = (transcript || [])
    .slice(-MAX_TRANSCRIPT_TURNS)
    .map((turn: { role: string; text: string; time: number }) => ({
      role: turn.role,
      text: truncateText(turn.text),
      time: turn.time,
    }));

  const updateFields: any = {
    transcript: compactTranscript,
    questionsAsked: questionsAsked || [],
    lastQuestionIndex: lastQuestionIndex ?? 0,
    updatedAt: Date.now(),
  };

  if (allQuestions && allQuestions.length > 0) {
    updateFields.allQuestions = allQuestions;
  }

  if (questionsStatus && questionsStatus.length > 0) {
    updateFields.questionsStatus = questionsStatus;
  }

  const { db } = await connectMongoDB();

  await db.collection(COLLECTION).updateOne(
    { interviewID },
    {
      $set: updateFields,
      $setOnInsert: {
        interviewID,
        reconnectCount: 0,
        createdAt: Date.now(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ message: "Context saved" });
});

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  const { searchParams } = new URL(request.url);
  const interviewID = searchParams.get("interviewID");

  if (!interviewID) {
    return NextResponse.json(
      { error: "interviewID is required" },
      { status: 400 }
    );
  }

  const { db } = await connectMongoDB();

  await db.collection(COLLECTION).deleteOne({ interviewID });

  return NextResponse.json({ message: "Context deleted" });
});
