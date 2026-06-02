import { NextResponse } from "next/server";
import OpenAI from "openai";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { texts } = await request.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: "texts array is required" },
        { status: 400 }
      );
    }

    // Limit batch size to avoid token limits
    const MAX_BATCH_SIZE = 100;
    const batches: string[][] = [];
    
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      batches.push(texts.slice(i, i + MAX_BATCH_SIZE));
    }

    const allEmbeddings: number[][] = [];

    // Process batches sequentially
    for (const batch of batches) {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-large", // Higher accuracy model (3,072 dimensions)
        input: batch,
      });

      const batchEmbeddings = response.data.map(item => item.embedding);
      allEmbeddings.push(...batchEmbeddings);
    }

    return NextResponse.json({
      embeddings: allEmbeddings,
    });
  } catch (error: any) {
    console.error("Error getting embeddings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get embeddings" },
      { status: 500 }
    );
  }
});

