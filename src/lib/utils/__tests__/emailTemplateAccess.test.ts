import {
  canViewTemplate,
  canEditTemplate,
  canDeleteTemplate,
  canCreateTemplate,
  isSuperAdmin,
  EmailTemplate,
} from "../emailTemplateAccess";

// Mock user data
const superAdminUser = { email: "bryce.mercines@whitecloak.com" };
const regularUser = { email: "regular.user@company.com" };
const userWithoutEmail = { name: "John Doe" };

// Mock template data
const userTemplate: EmailTemplate = {
  _id: "1",
  name: "User Template",
  subject: "Test Subject",
  messagePreview: "Test preview",
  fullMessage: "Test message",
  dateCreated: new Date(),
  templateType: "user",
  isActive: true,
  userEmail: "regular.user@company.com",
  orgID: "org123",
};

const globalTemplate: EmailTemplate = {
  _id: "2",
  name: "Global Template",
  subject: "Global Subject",
  messagePreview: "Global preview",
  fullMessage: "Global message",
  dateCreated: new Date(),
  templateType: "global",
  isActive: true,
  orgID: "org123",
};

const systemTemplate: EmailTemplate = {
  _id: "3",
  name: "System Template",
  subject: "System Subject",
  messagePreview: "System preview",
  fullMessage: "System message",
  dateCreated: new Date(),
  templateType: "system",
  isActive: true,
};

describe("Email Template Access Control", () => {
  describe("isSuperAdmin", () => {
    it("should return true for super admin users", () => {
      expect(isSuperAdmin(superAdminUser)).toBe(true);
    });

    it("should return false for regular users", () => {
      expect(isSuperAdmin(regularUser)).toBe(false);
    });

    it("should return false for users without email", () => {
      expect(isSuperAdmin(userWithoutEmail)).toBe(false);
    });
  });

  describe("canViewTemplate", () => {
    it("should allow anyone to view system templates", () => {
      expect(canViewTemplate(systemTemplate, regularUser, "org123")).toBe(true);
      expect(canViewTemplate(systemTemplate, superAdminUser, "org456")).toBe(
        true
      );
    });

    it("should allow organization members to view global templates", () => {
      expect(canViewTemplate(globalTemplate, regularUser, "org123")).toBe(true);
      expect(canViewTemplate(globalTemplate, regularUser, "org456")).toBe(
        false
      );
    });

    it("should only allow creators to view their user templates", () => {
      expect(canViewTemplate(userTemplate, regularUser, "org123")).toBe(true);
      expect(canViewTemplate(userTemplate, superAdminUser, "org123")).toBe(
        false
      );
      expect(canViewTemplate(userTemplate, regularUser, "org456")).toBe(false);
    });
  });

  describe("canEditTemplate", () => {
    it("should only allow super admins to edit system templates", () => {
      expect(canEditTemplate(systemTemplate, superAdminUser, "org123")).toBe(
        true
      );
      expect(canEditTemplate(systemTemplate, regularUser, "org123")).toBe(
        false
      );
    });

    it("should allow organization members to edit global templates", () => {
      expect(canEditTemplate(globalTemplate, regularUser, "org123")).toBe(true);
      expect(canEditTemplate(globalTemplate, regularUser, "org456")).toBe(
        false
      );
    });

    it("should only allow creators to edit their user templates", () => {
      expect(canEditTemplate(userTemplate, regularUser, "org123")).toBe(true);
      expect(canEditTemplate(userTemplate, superAdminUser, "org123")).toBe(
        false
      );
      expect(canEditTemplate(userTemplate, regularUser, "org456")).toBe(false);
    });
  });

  describe("canDeleteTemplate", () => {
    it("should not allow anyone to delete system templates", () => {
      expect(canDeleteTemplate(systemTemplate, superAdminUser, "org123")).toBe(
        false
      );
      expect(canDeleteTemplate(systemTemplate, regularUser, "org123")).toBe(
        false
      );
    });

    it("should allow organization members to delete global templates", () => {
      expect(canDeleteTemplate(globalTemplate, regularUser, "org123")).toBe(
        true
      );
      expect(canDeleteTemplate(globalTemplate, regularUser, "org456")).toBe(
        false
      );
    });

    it("should only allow creators to delete their user templates", () => {
      expect(canDeleteTemplate(userTemplate, regularUser, "org123")).toBe(true);
      expect(canDeleteTemplate(userTemplate, superAdminUser, "org123")).toBe(
        false
      );
      expect(canDeleteTemplate(userTemplate, regularUser, "org456")).toBe(
        false
      );
    });
  });

  describe("canCreateTemplate", () => {
    it("should only allow super admins to create system templates", () => {
      expect(canCreateTemplate("system", superAdminUser, "org123")).toBe(true);
      expect(canCreateTemplate("system", regularUser, "org123")).toBe(false);
    });

    it("should allow organization members to create global templates", () => {
      expect(canCreateTemplate("global", regularUser, "org123")).toBe(true);
      expect(canCreateTemplate("global", regularUser)).toBe(false);
    });

    it("should allow organization members to create user templates", () => {
      expect(canCreateTemplate("user", regularUser, "org123")).toBe(true);
      expect(canCreateTemplate("user", regularUser)).toBe(false);
    });
  });
});
