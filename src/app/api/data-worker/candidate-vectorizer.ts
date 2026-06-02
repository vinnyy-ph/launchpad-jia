import connectMongoDB from "@/lib/mongoDB/mongoDB";

export async function vectorizeCandidates() {
  const { db } = await connectMongoDB();
  console.log("Starting candidate vectorization process...\n");

  // 1. Take all unique entries in mongodb applicants collection, unique by email field, take the first 10
  const uniqueApplicants = await db.collection("applicants").aggregate([
    {
      $group: {
        _id: "$email",
        applicant: { $first: "$$ROOT" }
      }
    },
    { $limit: 200 }
  ]).toArray();

  const results = [];

  for (const entry of uniqueApplicants) {
    const applicant = entry.applicant;
    const email = applicant.email;

    if (!email) continue;

    // 2. Collection dependency data from other collections:
    
    // - CVData from applicant-cv use email as identifier
    const cvData = await db.collection("applicant-cv").findOne({ email });

    // - candidateSkills from org-candidate-skills use candidateEmail as identifier, 
    // return as 1d array with only the mapped values of skillName, make sure no values are repeated
    const skillDocs = await db.collection("candidate-skills").find({ candidateEmail: email }).toArray();
    const uniqueSkills = [...new Set(skillDocs.map(doc => doc.skillName).filter(Boolean))];

    // 3. Store result for return
    const candidateInfo = {
      name: applicant.name || "N/A",
      email: email,
      cvData: cvData,
      candidateSkills: uniqueSkills
    };

    console.log("=========================================");
    console.log(`Applicant Name: ${candidateInfo.name}`);
    console.log(`Email: ${candidateInfo.email}`);
    // We'll log a summary for the console but return full data
    console.log("CV Data: Found");
    console.log("Candidate Skills:", JSON.stringify(uniqueSkills));
    console.log("=========================================\n");

    results.push(candidateInfo);
  }

  return results;
}

