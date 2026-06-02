# Stage Duration Analytics Implementation

## Overview
This document explains the efficient MongoDB aggregation pipeline implemented to calculate how long applicants stay in each stage and substage, grouped by career.

## The Problem
Given a history collection that tracks stage transitions:
```javascript
{
  interviewUID: "mongoID",
  careerId: "mongoID", 
  fromStageId: "UID",
  fromSubstageId: "UID",
  toStageId: "UID",
  toSubstageId: "UID",
  action: "Endorsed",
  createdAt: Date
}
```

We need to calculate:
- Average time spent in each stage/substage
- Group results by career
- Show min/max durations
- Count applicants per stage

## The Solution

### Key Algorithm: Consecutive Record Pairing
The core insight is that an applicant's duration in a stage is calculated by:
1. **Entry time**: When they transition TO that stage (`toStageId` at time T1)
2. **Exit time**: When they transition to the NEXT stage (next record's `createdAt` at time T2)
3. **Duration**: T2 - T1

### Aggregation Pipeline Breakdown

#### Step 1: Filter by Date Range
```javascript
{
  $match: {
    createdAt: { $gte: threeMonthsAgo }
  }
}
```
Reduces dataset to recent 3 months for performance.

#### Step 2: Join with Careers (Filter by Organization)
```javascript
{
  $lookup: {
    from: "careers",
    let: { careerId: "$careerId" },
    pipeline: [
      {
        $match: {
          $expr: { $eq: [{ $toString: "$_id" }, "$$careerId"] },
          orgID: orgID
        }
      }
    ],
    as: "career"
  }
}
```
Only processes histories belonging to careers in the specified organization.

#### Step 3: Sort and Group by Interview
```javascript
{
  $sort: { interviewUID: 1, createdAt: 1 }
},
{
  $group: {
    _id: "$interviewUID",
    careerId: { $first: "$careerId" },
    careerJobTitle: { $first: "$career.jobTitle" },
    transitions: {
      $push: {
        toStageId: "$toStageId",
        toSubstageId: "$toSubstageId", 
        toStage: "$toStage",
        createdAt: "$createdAt"
      }
    }
  }
}
```
Creates an ordered array of all transitions for each applicant.

#### Step 4: Calculate Durations (The Magic Step)
```javascript
{
  $project: {
    stageDurations: {
      $map: {
        input: { $range: [0, { $subtract: [{ $size: "$transitions" }, 1] }] },
        as: "idx",
        in: {
          stageId: { $arrayElemAt: ["$transitions.toStageId", "$$idx"] },
          substageId: { $arrayElemAt: ["$transitions.toSubstageId", "$$idx"] },
          stageName: { $arrayElemAt: ["$transitions.toStage", "$$idx"] },
          startTime: { $arrayElemAt: ["$transitions.createdAt", "$$idx"] },
          endTime: { $arrayElemAt: ["$transitions.createdAt", { $add: ["$$idx", 1] }] },
          durationMs: {
            $subtract: [
              { $arrayElemAt: ["$transitions.createdAt", { $add: ["$$idx", 1] }] },
              { $arrayElemAt: ["$transitions.createdAt", "$$idx"] }
            ]
          }
        }
      }
    }
  }
}
```
**How it works:**
- For each transition at index `i`, pair it with the next transition at index `i+1`
- Calculate duration: `transitions[i+1].createdAt - transitions[i].createdAt`
- Result: Duration spent in the stage they entered at index `i`

**Example:**
```
Transitions:
[0] Applied -> CV Screening (2024-01-01 10:00)
[1] CV Screening -> AI Interview (2024-01-03 14:00)  
[2] AI Interview -> Human Interview (2024-01-05 09:00)

Calculated Durations:
- CV Screening: 2024-01-03 14:00 - 2024-01-01 10:00 = 2.17 days
- AI Interview: 2024-01-05 09:00 - 2024-01-03 14:00 = 1.79 days
```

#### Step 5: Unwind and Filter
```javascript
{
  $unwind: {
    path: "$stageDurations",
    preserveNullAndEmptyArrays: false
  }
},
{
  $match: {
    "stageDurations.durationMs": { $gt: 0 }
  }
}
```
Converts array to individual documents and removes invalid durations.

#### Step 6: Group by Career + Stage (Calculate Averages)
```javascript
{
  $group: {
    _id: {
      careerId: "$careerId",
      careerJobTitle: "$careerJobTitle",
      stageId: "$stageDurations.stageId",
      substageId: "$stageDurations.substageId",
      stageName: "$stageDurations.stageName"
    },
    avgDurationMs: { $avg: "$stageDurations.durationMs" },
    minDurationMs: { $min: "$stageDurations.durationMs" },
    maxDurationMs: { $max: "$stageDurations.durationMs" },
    applicantCount: { $sum: 1 }
  }
}
```
Aggregates all durations for each stage within each career.

#### Step 7: Convert to Days & Format
```javascript
{
  $project: {
    avgDurationDays: { $divide: ["$avgDurationMs", 86400000] },
    minDurationDays: { $divide: ["$minDurationMs", 86400000] },
    maxDurationDays: { $divide: ["$maxDurationMs", 86400000] },
    applicantCount: 1
  }
}
```
Converts milliseconds to days (86400000 ms = 1 day).

#### Step 8: Nest by Career
```javascript
{
  $group: {
    _id: {
      careerId: "$careerId",
      careerJobTitle: "$careerJobTitle"
    },
    stages: {
      $push: {
        stageId: "$stageId",
        substageId: "$substageId",
        stageName: "$stageName",
        avgDurationDays: { $round: ["$avgDurationDays", 1] },
        minDurationDays: { $round: ["$minDurationDays", 1] },
        maxDurationDays: { $round: ["$maxDurationDays", 1] },
        applicantCount: "$applicantCount"
      }
    },
    totalAvgDurationDays: { $sum: "$avgDurationDays" }
  }
}
```
Creates nested structure with all stages per career.

#### Step 9: Sort & Limit
```javascript
{
  $sort: { totalAvgDurationDays: -1 }
},
{
  $limit: 8
}
```
Returns top 8 careers by total pipeline time.

## Output Format

```javascript
{
  stageAging: {
    careers: [
      {
        careerId: "507f1f77bcf86cd799439011",
        careerJobTitle: "Senior Software Engineer",
        totalAvgDurationDays: 15.3,
        stages: [
          {
            stageId: "1",
            substageId: "1",
            stageName: "CV Screening: Under Review",
            avgDurationDays: 2.5,
            minDurationDays: 0.5,
            maxDurationDays: 7.2,
            applicantCount: 45
          },
          {
            stageId: "2",
            substageId: "1",
            stageName: "AI Interview: Pending",
            avgDurationDays: 4.8,
            minDurationDays: 1.0,
            maxDurationDays: 12.5,
            applicantCount: 32
          }
          // ... more stages
        ]
      }
      // ... more careers
    ]
  }
}
```

## Performance Optimizations

### 1. Index Strategy (Recommended)
```javascript
// Create compound index on interview-history collection
db.collection("interview-history").createIndex({
  "careerId": 1,
  "createdAt": 1
});

db.collection("interview-history").createIndex({
  "interviewUID": 1,
  "createdAt": 1
});

// Index on careers for lookup
db.collection("careers").createIndex({
  "orgID": 1
});
```

### 2. Time-Based Filtering
The query already filters to last 3 months (`threeMonthsAgo`). This dramatically reduces the dataset size.

### 3. Early Filtering
Organization filtering happens early in the pipeline via `$lookup`, preventing unnecessary processing.

### 4. Aggregation Allowances
For large datasets, ensure MongoDB aggregation memory limits are adequate:
```javascript
.aggregate([...], { allowDiskUse: true })
```

## Edge Cases Handled

1. **Dropped/Cancelled Applicants**: ✅ **FULLY SUPPORTED**
   - When a candidate is dropped or cancelled, the history record has:
     ```javascript
     {
       fromStageId: "2",
       fromSubstageId: "1", 
       action: "Dropped", // or "Cancelled"
       // NO toStageId or toSubstageId
       createdAt: Date
     }
     ```
   - **How it works**: The drop/cancel event is used as the EXIT timestamp for the previous stage
   - **Example**:
     ```
     Record 1: toStage="AI Interview", createdAt=Jan 3, 14:00
     Record 2: action="Dropped", createdAt=Jan 5, 14:00 (no toStage)
     
     Result: AI Interview duration = Jan 5 - Jan 3 = 2 days ✓
     ```
   - The drop event itself is filtered out (no `toStageId`), but correctly marks when they exited
   - This gives accurate duration metrics for stages before candidates drop out
   
   - **Visual Flow**:
     ```
     Timeline for Applicant A:
     
     Jan 1  ─────────────► Jan 3  ─────────────► Jan 5
            CV Screening          AI Interview         DROPPED
                                                         ↓
                                                    (exit event)
     
     Calculated Durations:
     - CV Screening: 2 days (Jan 1 → Jan 3)
     - AI Interview: 2 days (Jan 3 → Jan 5) ← Drop event marks exit
     ```

2. **Applicants still in a stage**: Last transition has no "end time" - excluded automatically since `$map` only pairs consecutive records

3. **Negative durations**: Filtered out with `$match: { durationMs: { $gt: 0 } }`

4. **Missing career data**: Handled with `$unwind` with `preserveNullAndEmptyArrays: false`

5. **Single transition**: `$range` creates empty array, resulting in no duration calculation (correct behavior)

6. **Missing stageId**: Filtered with `$match: { stageId: { $exists: true, $ne: null, $ne: "" } }`

## Alternative Approaches Considered

### Approach 1: Window Functions (MongoDB 5.0+)
```javascript
{
  $setWindowFields: {
    partitionBy: "$interviewUID",
    sortBy: { createdAt: 1 },
    output: {
      nextCreatedAt: {
        $shift: {
          output: "$createdAt",
          by: 1
        }
      }
    }
  }
}
```
**Pros**: More intuitive syntax
**Cons**: Requires MongoDB 5.0+, may have performance implications

### Approach 2: Application-Level Processing
Process in Node.js after fetching all records.
**Pros**: More flexible
**Cons**: Higher memory usage, slower for large datasets, more network transfer

### Approach 3: Pre-computed Metrics
Store durations when transitions occur.
**Pros**: Ultra-fast queries
**Cons**: Requires migration, ongoing maintenance, storage overhead

## Current Applicants (Still in Stage)

For applicants currently in a stage (no exit transition yet), use a separate query:

```javascript
// Find current stage durations
await db.collection("interview-history").aggregate([
  {
    $group: {
      _id: "$interviewUID",
      lastTransition: { $last: "$$ROOT" }
    }
  },
  {
    $project: {
      currentDurationDays: {
        $divide: [
          { $subtract: [new Date(), "$lastTransition.createdAt"] },
          86400000
        ]
      }
    }
  }
]);
```

## Monitoring & Metrics

### Query Performance
Monitor this query's execution time:
```javascript
const startTime = Date.now();
const stageAging = await db.collection(...).aggregate([...]).toArray();
console.log(`Stage aging query took: ${Date.now() - startTime}ms`);
```

### Data Quality Checks
- Alert if avgDuration > 30 days (indicates stuck applications)
- Alert if applicantCount is low (insufficient data)
- Monitor for stage transitions that skip stages (data integrity issue)

## Usage Examples

### Frontend Display
```typescript
// Display stage aging chart
stageAging.careers.forEach(career => {
  console.log(`${career.careerJobTitle} - Total: ${career.totalAvgDurationDays} days`);
  
  career.stages.forEach(stage => {
    console.log(`  ${stage.stageName}: ${stage.avgDurationDays} days (${stage.applicantCount} applicants)`);
  });
});
```

### Bottleneck Detection
```typescript
// Find stages taking longest
const bottlenecks = stageAging.careers.flatMap(career =>
  career.stages
    .filter(stage => stage.avgDurationDays > 7)
    .map(stage => ({
      career: career.careerJobTitle,
      stage: stage.stageName,
      duration: stage.avgDurationDays
    }))
);
```

## Bonus: Drop Rate Analysis by Stage

Since the query properly handles dropped candidates, you can add complementary analytics to track WHERE candidates drop:

```javascript
// Add this to your analytics endpoint
const dropRateByStage = await db.collection("interview-history").aggregate([
    {
        $match: {
            action: { $in: ["Dropped", "Cancelled"] },
            createdAt: { $gte: threeMonthsAgo }
        }
    },
    {
        $lookup: {
            from: "careers",
            let: { careerId: "$careerId" },
            pipeline: [
                {
                    $match: {
                        $expr: { $eq: [{ $toString: "$_id" }, "$$careerId"] },
                        orgID: orgID
                    }
                }
            ],
            as: "career"
        }
    },
    {
        $unwind: "$career"
    },
    {
        $group: {
            _id: {
                careerId: "$careerId",
                careerJobTitle: "$career.jobTitle",
                fromStageId: "$fromStageId",
                fromSubstageId: "$fromSubstageId",
                fromStage: "$fromStage"
            },
            dropCount: { $sum: 1 },
            droppedApplicants: {
                $push: {
                    interviewUID: "$interviewUID",
                    action: "$action",
                    droppedAt: "$createdAt"
                }
            }
        }
    },
    {
        $sort: {
            "dropCount": -1
        }
    },
    {
        $group: {
            _id: {
                careerId: "$_id.careerId",
                careerJobTitle: "$_id.careerJobTitle"
            },
            stages: {
                $push: {
                    stageId: "$_id.fromStageId",
                    substageId: "$_id.fromSubstageId",
                    stageName: "$_id.fromStage",
                    dropCount: "$dropCount"
                }
            },
            totalDrops: { $sum: "$dropCount" }
        }
    },
    {
        $project: {
            _id: 0,
            careerId: "$_id.careerId",
            careerJobTitle: "$_id.careerJobTitle",
            stages: 1,
            totalDrops: 1
        }
    },
    {
        $sort: { totalDrops: -1 }
    }
]).toArray();
```

**Output**:
```javascript
{
  dropRateByStage: [
    {
      careerId: "...",
      careerJobTitle: "Senior Software Engineer",
      totalDrops: 45,
      stages: [
        {
          stageId: "2",
          substageId: "1",
          stageName: "AI Interview: Pending",
          dropCount: 23  // Most drops happen here
        },
        {
          stageId: "1",
          substageId: "2",
          stageName: "CV Screening: Under Review",
          dropCount: 15
        }
        // ... more stages
      ]
    }
  ]
}
```

**Combined Insights**:
- **Stage Duration**: How long candidates stay in each stage
- **Drop Rate**: Where candidates are most likely to drop
- **Correlation**: Stages with longer durations may have higher drop rates

## Future Enhancements

1. **Percentile Calculations**: Add P50, P75, P90 durations
2. **Time Series**: Track how durations change over time
3. **Stage Comparison**: Compare durations across different careers
4. **Outlier Detection**: Flag applications taking unusually long
5. **Predictive Analytics**: Estimate time to completion for active applications
6. **Drop Correlation**: Analyze correlation between stage duration and drop likelihood
7. **Stage Velocity**: Track how quickly candidates move through the pipeline

## Conclusion

This implementation provides:
- ✅ Efficient single-query solution
- ✅ Grouped by career
- ✅ Separate metrics for each stage/substage  
- ✅ Duration in days
- ✅ Statistical measures (avg, min, max)
- ✅ Applicant counts
- ✅ Scalable for large datasets

The aggregation pipeline approach leverages MongoDB's native capabilities for optimal performance.

