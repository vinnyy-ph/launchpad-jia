import { ensureCareerFetchIndexes, CAREER_FETCH_INDEXES, __resetEnsureIndexesForTests } from "../ensureIndexes";

const mockDb = () => {
  const createIndex = jest.fn().mockResolvedValue("ok");
  return { db: { collection: jest.fn(() => ({ createIndex })) } as any, createIndex };
};

describe("ensureCareerFetchIndexes", () => {
  beforeEach(() => __resetEnsureIndexesForTests());

  it("creates every declared index once", async () => {
    const { db, createIndex } = mockDb();
    await ensureCareerFetchIndexes(db);
    expect(createIndex).toHaveBeenCalledTimes(CAREER_FETCH_INDEXES.length);
    for (const { collection } of CAREER_FETCH_INDEXES) {
      expect(db.collection).toHaveBeenCalledWith(collection);
    }
  });

  it("declares the seven indexes from the spec", () => {
    const byCollection = Object.fromEntries(CAREER_FETCH_INDEXES.map((i) => [i.collection, i]));
    expect(byCollection["interviews"].key).toEqual({ id: 1 });
    expect(byCollection["careers"].key).toEqual({ id: 1 });
    expect(byCollection["recruiter-evaluations"].key).toEqual({ interviewUID: 1, action: 1, createdAt: -1 });
    expect(byCollection["comments"].key).toEqual({ interviewID: 1, type: 1 });
    expect(byCollection["interview-history"].key).toEqual({ interviewUID: 1, createdAt: -1 });
    expect(byCollection["recruiter-history"].key).toEqual({ interviewUID: 1, createdAt: -1 });
    expect(byCollection["applicants"].key).toEqual({ email: 1 });
    expect(byCollection["applicants"].options).toEqual({ collation: { locale: "en", strength: 2 } });
    expect(CAREER_FETCH_INDEXES).toHaveLength(7);
  });

  it("memoizes: second call does not re-create", async () => {
    const { db, createIndex } = mockDb();
    await ensureCareerFetchIndexes(db);
    await ensureCareerFetchIndexes(db);
    expect(createIndex).toHaveBeenCalledTimes(CAREER_FETCH_INDEXES.length);
  });

  it("resolves (does not throw) when createIndex fails", async () => {
    const db = { collection: () => ({ createIndex: jest.fn().mockRejectedValue(new Error("boom")) }) } as any;
    await expect(ensureCareerFetchIndexes(db)).resolves.toBeUndefined();
  });
});
