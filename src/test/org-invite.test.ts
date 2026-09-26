import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCommunityOrg,
  getOrgAdminOctokit,
  getOrgMembershipStatus,
  inviteUserToOrg,
  ensureOrgMembership,
  clearMembershipCache,
  checkIsPublicMember,
  publicizeMembership,
  attemptAutoAccept,
  ensureOrgWebhook,
} from "../../server/src/lib/org-invite.js";

describe("GitHub Organization Invite Service", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    clearMembershipCache();
    delete process.env.GITHUB_ORG_ADMIN_TOKEN;
    delete process.env.GITHUB_COMMUNITY_ORG;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("Configuration helpers", () => {
    it("should return default community org when env is not set", () => {
      expect(getCommunityOrg()).toBe("evergreeners");
    });

    it("should return custom community org when GITHUB_COMMUNITY_ORG is set", () => {
      process.env.GITHUB_COMMUNITY_ORG = "custom-org";
      expect(getCommunityOrg()).toBe("custom-org");
    });

    it("should return null for getOrgAdminOctokit when GITHUB_ORG_ADMIN_TOKEN is missing", () => {
      expect(getOrgAdminOctokit()).toBeNull();
    });

    it("should return an Octokit instance when GITHUB_ORG_ADMIN_TOKEN is present", () => {
      process.env.GITHUB_ORG_ADMIN_TOKEN = "ghp_test_token";
      const octokit = getOrgAdminOctokit();
      expect(octokit).not.toBeNull();
    });
  });

  describe("getOrgMembershipStatus without admin token", () => {
    it("should return status 'not_configured' when token is missing", async () => {
      const res = await getOrgMembershipStatus("testuser");
      expect(res.status).toBe("not_configured");
    });
  });

  describe("inviteUserToOrg without admin token", () => {
    it("should return status 'not_configured' and success false when token is missing", async () => {
      const res = await inviteUserToOrg("testuser");
      expect(res.success).toBe(false);
      expect(res.status).toBe("not_configured");
    });
  });

  describe("ensureOrgMembership without admin token", () => {
    it("should return 'not_configured' without failing", async () => {
      const res = await ensureOrgMembership("testuser");
      expect(res.status).toBe("not_configured");
    });
  });

  describe("Cache management", () => {
    it("should allow clearing cache without errors", () => {
      expect(() => clearMembershipCache("someuser")).not.toThrow();
      expect(() => clearMembershipCache()).not.toThrow();
    });
  });

  describe("checkIsPublicMember", () => {
    it("should return true when GitHub returns 204", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));
      const isPublic = await checkIsPublicMember("octocat");
      expect(isPublic).toBe(true);
      fetchSpy.mockRestore();
    });

    it("should return false when GitHub returns 404", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 404 }));
      const isPublic = await checkIsPublicMember("octocat");
      expect(isPublic).toBe(false);
      fetchSpy.mockRestore();
    });
  });

  describe("publicizeMembership", () => {
    it("should return success true when GitHub returns 204", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));
      const res = await publicizeMembership("octocat", "gho_token");
      expect(res.success).toBe(true);
      fetchSpy.mockRestore();
    });

    it("should return success false when GitHub returns non-204", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));
      const res = await publicizeMembership("octocat", "gho_token");
      expect(res.success).toBe(false);
      fetchSpy.mockRestore();
    });
  });

  describe("attemptAutoAccept", () => {
    it("should return success true when status is 200", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ state: "active" }), { status: 200 }));
      const res = await attemptAutoAccept("gho_token");
      expect(res.success).toBe(true);
      fetchSpy.mockRestore();
    });

    it("should return success false when status is 403", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));
      const res = await attemptAutoAccept("gho_token");
      expect(res.success).toBe(false);
      fetchSpy.mockRestore();
    });
  });

  describe("ensureOrgWebhook without admin token", () => {
    it("should return success false when token is missing", async () => {
      const res = await ensureOrgWebhook();
      expect(res.success).toBe(false);
      expect(res.message).toBe("GITHUB_ORG_ADMIN_TOKEN not configured");
    });
  });
});
