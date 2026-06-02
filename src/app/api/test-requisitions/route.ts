import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";

interface TestResult {
  test: string;
  status: "PASS" | "FAIL";
  message: string;
  duration: number;
}

// GET /api/test-requisitions - Run all requisition flow tests (backend + database)
export async function GET() {
  const startTime = Date.now();
  const results: TestResult[] = [];
  let testRequisitionId: string | null = null;

  try {
    const { db } = await connectMongoDB();

    // Test 1: Database Connection
    await runTest(
      "1. Database Connection",
      async () => {
        await db.command({ ping: 1 });
        return { success: true, message: "MongoDB connected successfully" };
      },
      results
    );

    // Test 2: Create Requisition
    await runTest(
      "2. Create Requisition Flow",
      async () => {
        const testRequisition = {
          positionName: "Test Software Engineer",
          referenceNo: `TEST${Date.now()}`,
          dateSubmitted: new Date().toISOString(),
          status: "In Review",
          orgID: "test-org-id",
          submittedBy: {
            memberID: "test-member-id",
            name: "Test User",
            email: "test@example.com",
            avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=test",
          },
          formData: {
            positionName: "Test Software Engineer",
            jobDescription: "Test job description",
            headcount: "2",
            workArrangement: "Hybrid",
            workDays: "3 days per week",
            officeLocation: {
              country: "Philippines",
              stateProvince: "Metro Manila",
              city: "Makati",
            },
            salaryRange: {
              min: "50000",
              max: "80000",
              currency: "PHP",
            },
            employmentType: "Full-time",
            reason: "Test requisition for API validation",
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await db.collection("requisitions").insertOne(testRequisition);
        testRequisitionId = result.insertedId.toString();

        if (!result.insertedId) {
          throw new Error("Failed to create requisition");
        }

        return {
          success: true,
          message: `Requisition created with ID: ${testRequisitionId}`,
          requisitionId: testRequisitionId,
        };
      },
      results
    );

    // Test 3: Fetch Single Requisition
    await runTest(
      "3. Fetch Single Requisition Flow",
      async () => {
        if (!testRequisitionId) {
          throw new Error("No test requisition ID available");
        }

        const requisition = await db
          .collection("requisitions")
          .findOne({ _id: new ObjectId(testRequisitionId) });

        if (!requisition) {
          throw new Error("Requisition not found");
        }

        if (requisition.positionName !== "Test Software Engineer") {
          throw new Error("Requisition data mismatch");
        }

        return {
          success: true,
          message: `Fetched requisition: ${requisition.positionName} (${requisition.status})`,
        };
      },
      results
    );

    // Test 4: Update Status to "Requires More Info"
    await runTest(
      "4. Update Status → Requires More Info",
      async () => {
        if (!testRequisitionId) {
          throw new Error("No test requisition ID available");
        }

        const result = await db.collection("requisitions").findOneAndUpdate(
          { _id: new ObjectId(testRequisitionId) },
          {
            $set: {
              status: "Requires More Info",
              moreInfoReason: "<p>Test reason for more info</p>",
              moreInfoBy: "Test Recruiter",
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after" }
        );

        if (!result || result.status !== "Requires More Info") {
          throw new Error("Status update failed");
        }

        if (!result.moreInfoReason || !result.moreInfoBy) {
          throw new Error("Metadata not saved correctly");
        }

        return {
          success: true,
          message: `Status: ${result.status} | Reason: ${result.moreInfoReason?.substring(0, 30)}...`,
        };
      },
      results
    );

    // Test 5: Update Status to "Request to Cancel"
    await runTest(
      "5. Update Status → Request to Cancel",
      async () => {
        if (!testRequisitionId) {
          throw new Error("No test requisition ID available");
        }

        const result = await db.collection("requisitions").findOneAndUpdate(
          { _id: new ObjectId(testRequisitionId) },
          {
            $set: {
              status: "Request to Cancel",
              cancelReason: "Test cancellation reason",
              updatedAt: new Date(),
            },
            $unset: {
              moreInfoReason: "",
              moreInfoBy: "",
            },
          },
          { returnDocument: "after" }
        );

        if (!result || result.status !== "Request to Cancel") {
          throw new Error("Status update failed");
        }

        if (!result.cancelReason) {
          throw new Error("Cancel reason not saved");
        }

        if (result.moreInfoReason || result.moreInfoBy) {
          throw new Error("Previous metadata not cleared");
        }

        return {
          success: true,
          message: `Status: ${result.status} | Cancel Reason: ${result.cancelReason}`,
        };
      },
      results
    );

    // Test 6: Update Status to "Active"
    await runTest(
      "6. Update Status → Active",
      async () => {
        if (!testRequisitionId) {
          throw new Error("No test requisition ID available");
        }

        const result = await db.collection("requisitions").findOneAndUpdate(
          { _id: new ObjectId(testRequisitionId) },
          {
            $set: {
              status: "Active",
              updatedAt: new Date(),
            },
            $unset: {
              cancelReason: "",
            },
          },
          { returnDocument: "after" }
        );

        if (!result || result.status !== "Active") {
          throw new Error("Status update failed");
        }

        if (result.cancelReason) {
          throw new Error("Cancel reason not cleared");
        }

        return {
          success: true,
          message: `Status: ${result.status} (metadata cleared)`,
        };
      },
      results
    );

    // Test 7: Update Status to "On Hold"
    await runTest(
      "7. Update Status → On Hold",
      async () => {
        if (!testRequisitionId) {
          throw new Error("No test requisition ID available");
        }

        const result = await db.collection("requisitions").findOneAndUpdate(
          { _id: new ObjectId(testRequisitionId) },
          {
            $set: {
              status: "On Hold",
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after" }
        );

        if (!result || result.status !== "On Hold") {
          throw new Error("Status update failed");
        }

        return {
          success: true,
          message: `Status: ${result.status}`,
        };
      },
      results
    );

    // Test 8: Update Status to "Cancelled"
    await runTest(
      "8. Update Status → Cancelled",
      async () => {
        if (!testRequisitionId) {
          throw new Error("No test requisition ID available");
        }

        const result = await db.collection("requisitions").findOneAndUpdate(
          { _id: new ObjectId(testRequisitionId) },
          {
            $set: {
              status: "Cancelled",
              cancelReason: "Test complete cancellation",
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after" }
        );

        if (!result || result.status !== "Cancelled") {
          throw new Error("Status update failed");
        }

        if (!result.cancelReason) {
          throw new Error("Cancel reason not saved");
        }

        return {
          success: true,
          message: `Status: ${result.status} | Cancel Reason: ${result.cancelReason}`,
        };
      },
      results
    );

    // Test 9: Update Requisition Form Data
    await runTest(
      "9. Update Requisition Form Data",
      async () => {
        if (!testRequisitionId) {
          throw new Error("No test requisition ID available");
        }

        const updatedFormData = {
          positionName: "Updated Test Software Engineer",
          jobDescription: "Updated test job description",
          headcount: "3",
          workArrangement: "Remote",
          officeLocation: {
            country: "Philippines",
            stateProvince: "Metro Manila",
            city: "Taguig",
          },
          salaryRange: {
            min: "60000",
            max: "90000",
            currency: "PHP",
          },
          employmentType: "Full-time",
          reason: "Updated test requisition",
        };

        const result = await db.collection("requisitions").findOneAndUpdate(
          { _id: new ObjectId(testRequisitionId) },
          {
            $set: {
              positionName: updatedFormData.positionName,
              formData: updatedFormData,
              status: "In Review",
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after" }
        );

        if (!result || result.positionName !== "Updated Test Software Engineer") {
          throw new Error("Form data update failed");
        }

        if (result.status !== "In Review") {
          throw new Error("Status not reset to 'In Review'");
        }

        return {
          success: true,
          message: `Updated: ${result.positionName} | Status reset to: ${result.status}`,
        };
      },
      results
    );

    // Test 10: Delete Requisition (Cleanup)
    await runTest(
      "10. Delete Requisition & Cleanup",
      async () => {
        if (!testRequisitionId) {
          throw new Error("No test requisition ID available");
        }

        const result = await db
          .collection("requisitions")
          .deleteOne({ _id: new ObjectId(testRequisitionId) });

        if (result.deletedCount === 0) {
          throw new Error("Failed to delete requisition");
        }

        // Verify deletion
        const deleted = await db
          .collection("requisitions")
          .findOne({ _id: new ObjectId(testRequisitionId) });

        if (deleted) {
          throw new Error("Requisition still exists after deletion");
        }

        return {
          success: true,
          message: `Requisition deleted successfully (ID: ${testRequisitionId})`,
        };
      },
      results
    );

    // Calculate summary
    const totalDuration = Date.now() - startTime;
    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;

    return NextResponse.json({
      summary: {
        total: results.length,
        passed,
        failed,
        duration: `${totalDuration}ms`,
        status: failed === 0 ? "ALL TESTS PASSED ✅" : `${failed} TEST(S) FAILED ❌`,
      },
      tests: results,
    }, { status: 200 });
  } catch (error: any) {
    console.error("Test suite error:", error);

    // If we have a test requisition, try to clean it up
    if (testRequisitionId) {
      try {
        const { db } = await connectMongoDB();
        await db
          .collection("requisitions")
          .deleteOne({ _id: new ObjectId(testRequisitionId) });
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        error: true,
        message: error.message || "Test suite failed",
        results,
      },
      { status: 500 }
    );
  }
}

// Helper function to run individual tests
async function runTest(
  testName: string,
  testFn: () => Promise<any>,
  results: TestResult[]
): Promise<void> {
  const startTime = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;

    results.push({
      test: testName,
      status: "PASS",
      message: result.message || "Test passed",
      duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    results.push({
      test: testName,
      status: "FAIL",
      message: error.message || "Test failed",
      duration,
    });
  }
}
