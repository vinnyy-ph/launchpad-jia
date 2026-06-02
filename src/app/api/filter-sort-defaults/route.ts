import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import {
  FILTER_SORT_DEFAULTS_VERSION,
  FILTER_SORT_DEFAULTS_SCREENS,
  sanitizeDefaultsByScreen,
} from "@/lib/utils/filterSortDefaults";

const COLLECTION_NAME = "filter-sort-defaults";
const VALID_SCREENS = new Set<string>(Object.values(FILTER_SORT_DEFAULTS_SCREENS));

let indexPromise: Promise<void> | null = null;

function ensureIndexes(db: any): Promise<void> {
  if (!indexPromise) {
    indexPromise = db
      .collection(COLLECTION_NAME)
      .createIndex(
        { userId: 1, orgID: 1, screen: 1 },
        { unique: true, name: "user_org_screen_unique" }
      )
      .catch(() => {
        // Index already exists — ignore
      });
  }
  return indexPromise;
}

function getScreenAndOrgFromQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  return {
    orgID: searchParams.get("orgID"),
    screen: searchParams.get("screen"),
  };
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const email = request.user.email;
    const { orgID, screen } = getScreenAndOrgFromQuery(request);

    if (!orgID) {
      return NextResponse.json({ error: "orgID is required" }, { status: 400 });
    }
    if (!screen || !VALID_SCREENS.has(screen)) {
      return NextResponse.json({ error: "Valid screen is required" }, { status: 400 });
    }

    const { db } = await connectMongoDB();
    const authResult = await verifyUserIsMember(db, email, orgID);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason }, { status: 403 });
    }

    const document = await db.collection(COLLECTION_NAME).findOne(
      {
        userId: email,
        orgID,
        screen,
      },
      {
        projection: {
          _id: 0,
          defaults: 1,
          version: 1,
          updatedAt: 1,
        },
      }
    );

    return NextResponse.json({
      defaults: document?.defaults ?? null,
      version: document?.version ?? null,
      updatedAt: document?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Error fetching filter/sort defaults:", error);
    return NextResponse.json(
      { error: "Failed to fetch filter/sort defaults" },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const email = request.user.email;
    const body = await request.json();
    const orgID = body?.orgID;
    const screen = body?.screen;
    const defaults = body?.defaults;

    if (!orgID) {
      return NextResponse.json({ error: "orgID is required" }, { status: 400 });
    }
    if (!screen || !VALID_SCREENS.has(screen)) {
      return NextResponse.json({ error: "Valid screen is required" }, { status: 400 });
    }

    const sanitizedDefaults = sanitizeDefaultsByScreen(screen, defaults);
    if (!sanitizedDefaults) {
      return NextResponse.json(
        { error: "Could not sanitize defaults payload" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const authResult = await verifyUserIsMember(db, email, orgID);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason }, { status: 403 });
    }

    await ensureIndexes(db);

    await db.collection(COLLECTION_NAME).updateOne(
      {
        userId: email,
        orgID,
        screen,
      },
      {
        $set: {
          defaults: sanitizedDefaults,
          version: FILTER_SORT_DEFAULTS_VERSION,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      }
    );

    return NextResponse.json({
      success: true,
      defaults: sanitizedDefaults,
      version: FILTER_SORT_DEFAULTS_VERSION,
    });
  } catch (error) {
    console.error("Error saving filter/sort defaults:", error);
    return NextResponse.json(
      { error: "Failed to save filter/sort defaults" },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const email = request.user.email;
    const body = await request.json().catch(() => ({}));
    const query = getScreenAndOrgFromQuery(request);
    const orgID = body?.orgID || query.orgID;
    const screen = body?.screen || query.screen;

    if (!orgID) {
      return NextResponse.json({ error: "orgID is required" }, { status: 400 });
    }
    if (!screen || !VALID_SCREENS.has(screen)) {
      return NextResponse.json({ error: "Valid screen is required" }, { status: 400 });
    }

    const { db } = await connectMongoDB();
    const authResult = await verifyUserIsMember(db, email, orgID);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason }, { status: 403 });
    }

    await db.collection(COLLECTION_NAME).deleteOne({
      userId: email,
      orgID,
      screen,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting filter/sort defaults:", error);
    return NextResponse.json(
      { error: "Failed to delete filter/sort defaults" },
      { status: 500 }
    );
  }
});
