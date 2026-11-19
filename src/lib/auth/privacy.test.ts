import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const users = { id: "users.id", email: "users.email" };
  const assessmentResults = { userId: "assessmentResults.userId" };
  const responses = { userId: "responses.userId" };
  const profiles = { userId: "profiles.userId" };
  const matches = { userId: "matches.userId" };
  const skillPlans = { userId: "skillPlans.userId" };
  const verificationTokens = { identifier: "verificationTokens.identifier" };
  return {
    auth: vi.fn(),
    eq: vi.fn((column, value) => ({ column, value })),
    select: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    users,
    assessmentResults,
    responses,
    profiles,
    matches,
    skillPlans,
    verificationTokens,
  };
});

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("drizzle-orm", () => ({ eq: mocks.eq }));
vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    delete: mocks.delete,
    transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/db/schema", () => ({
  users: mocks.users,
  assessmentResults: mocks.assessmentResults,
  responses: mocks.responses,
  profiles: mocks.profiles,
  matches: mocks.matches,
  skillPlans: mocks.skillPlans,
  verificationTokens: mocks.verificationTokens,
}));

import { DELETE } from "@/app/api/data/delete/route";
import { GET } from "@/app/api/data/export/route";

const request = (origin?: string) =>
  new Request("https://insight.example/api/data/delete", {
    method: "DELETE",
    headers: origin ? { origin } : {},
  });

describe("privacy endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated export and deletion without querying data", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await DELETE(request("https://insight.example"))).status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("exports only the signed-in user's profile and results", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    const user = { id: "user-1", email: "user@example.test" };
    const results = [{ userId: "user-1", payload: {} }];
    const where = vi.fn().mockResolvedValue([]);
    where.mockResolvedValueOnce([user]).mockResolvedValueOnce(results);
    mocks.select.mockReturnValue({ from: () => ({ where }) });

    const response = await GET();
    expect(await response.json()).toEqual({
      user,
      assessmentResults: results,
      responses: [],
      profiles: [],
      matches: [],
      skillPlans: [],
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(where).toHaveBeenNthCalledWith(1, { column: "users.id", value: "user-1" });
    expect(where).toHaveBeenNthCalledWith(2, {
      column: "assessmentResults.userId",
      value: "user-1",
    });
    for (const [index, table] of ["responses", "profiles", "matches", "skillPlans"].entries()) {
      expect(where).toHaveBeenNthCalledWith(index + 3, {
        column: `${table}.userId`,
        value: "user-1",
      });
    }
  });

  it("rejects deletion from another or missing origin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    expect((await DELETE(request("https://evil.example"))).status).toBe(403);
    expect((await DELETE(request())).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects stale sessions whose user no longer exists", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "deleted-user" } });
    const where = vi.fn().mockResolvedValue([]);
    mocks.select.mockReturnValue({ from: () => ({ where }) });
    const tx = {
      select: () => ({ from: () => ({ where }) }),
      delete: vi.fn(),
    };
    mocks.transaction.mockImplementation((fn) => fn(tx));

    expect((await GET()).status).toBe(401);
    expect((await DELETE(request("https://insight.example"))).status).toBe(401);
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("deletes only the signed-in user and their outstanding email tokens", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    const selectWhere = vi.fn().mockResolvedValue([{ email: "user@example.test" }]);
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const tx = {
      select: () => ({ from: () => ({ where: selectWhere }) }),
      delete: vi.fn(() => ({ where: deleteWhere })),
    };
    mocks.transaction.mockImplementation((fn) => fn(tx));

    const response = await DELETE(request("https://insight.example"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(selectWhere).toHaveBeenCalledWith({ column: "users.id", value: "user-1" });
    expect(tx.delete).toHaveBeenNthCalledWith(1, mocks.verificationTokens);
    expect(deleteWhere).toHaveBeenNthCalledWith(1, {
      column: "verificationTokens.identifier",
      value: "user@example.test",
    });
    expect(tx.delete).toHaveBeenNthCalledWith(2, mocks.users);
    expect(deleteWhere).toHaveBeenNthCalledWith(2, { column: "users.id", value: "user-1" });
  });
});
