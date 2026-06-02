import { Db, ObjectId } from "mongodb";

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}


export async function resolveMemberIdentityMapByEmails(
  db: Db,
  orgID: string,
  emails: string[]
) {
  const normalizedEmails = uniqueStrings(
    emails
      .map((email) => (typeof email === "string" ? normalizeEmail(email) : ""))
      .filter((email) => Boolean(email))
  );

  if (normalizedEmails.length === 0) {
    return new Map<string, { id: string; email: string; name?: string; image?: string }>();
  }

  const [members, admins] = await Promise.all([
    db.collection("members")
      .find(
        { orgID, email: { $in: normalizedEmails } },
        { projection: { _id: 1, email: 1, name: 1, image: 1 } }
      )
      .toArray(),
    db.collection("admins")
      .find(
        { email: { $in: normalizedEmails } },
        { projection: { _id: 1, email: 1, name: 1, image: 1 } }
      )
      .toArray(),
  ]);

  const map = new Map<string, { id: string; email: string; name?: string; image?: string }>();
  [...members, ...admins].forEach((item: any) => {
    if (!item?._id || !item?.email) {
      return;
    }
    const key = normalizeEmail(item.email);
    if (!map.has(key)) {
      map.set(key, {
        id: item._id.toString(),
        email: key,
        name: item.name,
        image: item.image,
      });
    }
  });

  return map;
}

export async function attachMemberIdsByEmail(db: Db, orgID: string, members: any[]) {
  const emailsForLookup = members
    .map((member) => member?.email)
    .filter((email) => typeof email === "string")
    .map((email) => normalizeEmail(email));

  const identityMap = await resolveMemberIdentityMapByEmails(db, orgID, emailsForLookup);
  return members.map((member) => {
    const normalizedEmail =
      typeof member?.email === "string" ? normalizeEmail(member.email) : "";
    if (!normalizedEmail) {
      return member;
    }
    const identity = identityMap.get(normalizedEmail);
    if (!identity?.id) {
      return member;
    }
    return {
      ...member,
      id: identity.id,
    };
  });
}
