"use client";
import { useEffect, useState } from "react";
import RichTextEditor from "../CareerComponents/RichTextEditor";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import OrganizationStatus from "./OrgEditing/OrganizationStatus";
import philippineCitiesAndProvinces from "../../../../public/philippines-locations.json";
import {
  candidateActionToast,
  successToast,
  errorToast,
  validateEmail,
} from "@/lib/Utils";
import FullScreenLoadingAnimation from "../CareerComponents/FullScreenLoadingAnimation";
import OrganizationActionModal from "./OrganizationActionModal";
import DomainRecordsModal from "./DomainRecordsModal";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "../../context/AppContext";
import Swal from "sweetalert2";
import { Button } from "../ui";


const roleList = [
  {
    name: "hiring_manager",
  },
  {
    name: "admin",
  },
  {
    name: "super_admin",
  },
];

export default function OrganizationForm({
  organization,
  formType,
}: {
  organization?: any;
  formType: string;
}) {
  const { user } = useAppContext();
  const [name, setName] = useState(organization?.name || "");
  const [description, setDescription] = useState(
    organization?.description || ""
  );
  const [status, setStatus] = useState(organization?.status || "active");
  const [organizationPlan, setOrganizationPlan] = useState<{
    _id: string;
    name: string;
    jobLimit: number;
  } | null>(null);
  const [projectsEnabled, setProjectsEnabled] = useState(
    organization?.projectsEnabled || false
  );
  const [guestPortalEnabled, setGuestPortalEnabled] = useState(
    typeof organization?.guestPortalEnabled === "boolean"
      ? organization.guestPortalEnabled
      : !!organization?.projectsEnabled
  );
  const [organizationPlanList, setOrganizationPlanList] = useState<
    { _id: string; name: string; jobLimit: number }[]
  >([]);
  const [extraJobSlots, setExtraJobSlots] = useState(
    organization?.extraJobSlots || 0
  );
  const [country, setCountry] = useState(
    organization?.country || "Philippines"
  );
  const [province, setProvince] = useState(organization?.province || "");
  const [city, setCity] = useState(organization?.city || "");
  const [cityList, setCityList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [address, setAddress] = useState(organization?.address || "");
  const [companySlug, setCompanySlug] = useState(
    organization?.companySlug || ""
  );
  const [companyDomains, setCompanyDomains] = useState<string[]>(
    Array.isArray(organization?.companyDomains) &&
      organization.companyDomains.length > 0
      ? organization.companyDomains
      : [""]
  );
  const [domainButtonStates, setDomainButtonStates] = useState<
    Record<number, "save" | "view" | "loading" | "deleting">
  >({});
  const [recordsModalOpen, setRecordsModalOpen] = useState(false);
  const [recordsModalDomain, setRecordsModalDomain] = useState("");
  const [recordsModalRecords, setRecordsModalRecords] = useState<
    { type: string; host: string; value: string }[]
  >([]);
  const [recordsModalLoading, setRecordsModalLoading] = useState(false);
  const [recordsModalVerifying, setRecordsModalVerifying] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [companyRegistrationFile, setCompanyRegistrationFile] = useState<
    File | string | null
  >(
    organization?.documents?.find(
      (document: any) => document.name === "Company/SEC Registration"
    )?.filename || ""
  );
  const [businessPermitFile, setBusinessPermitFile] = useState<
    File | string | null
  >(
    organization?.documents?.find(
      (document: any) => document.name === "Business Permit"
    )?.filename || ""
  );
  const [coverImage, setCoverImage] = useState<File | string | null>(
    organization?.coverImage || ""
  );
  const [image, setImage] = useState<File | string | null>(
    organization?.image || ""
  );
  const [members, setMembers] = useState<
    { email: string; role: string; error?: string }[]
  >(
    organization?.members?.map((member: any) => ({
      email: member.email,
      role: member.role,
    })) || [
      {
        email: "",
        role: "",
      },
    ]
  );
  const [showSaveModal, setShowSaveModal] = useState("");
  const [subdomainStatus, setSubdomainStatus] = useState<{
    status: string;
    message: string;
    loading: boolean;
  } | null>(null);

  const fetchSubdomainStatus = async () => {
    if (!organization?._id) return;

    setSubdomainStatus({ status: "", message: "", loading: true });
    try {
      const response = await api.get(
        `/api/mailgun-module/fetch-domain-status?orgId=${organization._id}`
      );
      if (response.status === 200) {
        setSubdomainStatus({
          status: response.data.status,
          message: response.data.message,
          loading: false,
        });
      }
    } catch (error) {
      console.error("Error fetching subdomain status:", error);
      setSubdomainStatus({
        status: "error",
        message: "Failed to fetch status",
        loading: false,
      });
    }
  };

  const isFormValid = () => {
    return (
      image &&
      name &&
      members.length > 0 &&
      members.every((member) => member.email && member.role && !member.error)
    );
  };

  const validateMemberEmail = (email: string, index: number) => {
    if (!validateEmail(email)) {
      return "Invalid email address";
    }

    // Check if email is already in the members array
    const otherMembers = members.filter((member, i) => i !== index);
    if (otherMembers.some((member) => member.email === email)) {
      return "Email already exists";
    }

    return null;
  };

  const validateFile = (file: File) => {
    if (file.size > 1024 * 1024 * 2) {
      errorToast("File size must be less than 2MB", 1300);
      return false;
    }
    return true;
  };

  const uploadFile = async (
    file: File,
    fileName: string
  ): Promise<string | null> => {
    try {
      const response = await api.post("/api/admin/get-presigned-url", {
        fileName,
        fileType: file.type,
      });
      const uploadResponse = await fetch(response.data.presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
      if (uploadResponse.status !== 200) {
        throw new Error("Error uploading file");
      }
      return fileName;
    } catch (error) {
      errorToast("Error uploading file", 1300);
      return null;
    }
  };

  // Validation functions
  const isValidDomainFormat = (domain: string): boolean => {
    // Domain format: label(s) separated by dots, TLD must be 2+ letters
    const domainRegex =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:[a-z]{2,}|xn--[a-z0-9]+)$/i;
    return domainRegex.test(domain.toLowerCase());
  };

  const isValidSlugFormat = (slug: string): boolean => {
    // Slug format: lowercase letters, numbers, hyphens only, 3-50 characters
    const slugRegex = /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/;
    return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
  };

  const getEffectiveOrgId = () => organization?._id || "";

  const saveSubdomain = async () => {
    const cleanSlug = (companySlug || "").trim();
    if (!cleanSlug) {
      errorToast("Enter a company slug first", 1300);
      return;
    }

    // Validate slug format
    if (!isValidSlugFormat(cleanSlug)) {
      errorToast(
        "Slug must be 3-50 characters, lowercase letters, numbers, and hyphens only",
        1300
      );
      return;
    }

    const orgId = getEffectiveOrgId();
    if (!orgId) {
      errorToast("Save organization first", 1300);
      return;
    }

    setSubdomainStatus({ status: "", message: "", loading: true });

    try {
      // First, update the organization with the company slug
      await api.post("/api/admin/update-organization", {
        orgID: orgId,
        update: {
          companySlug: cleanSlug,
        },
      });

      // Then create the subdomain (skip verification for quick save)
      const response = await api.post(
        `/api/mailgun-module/add-subdomain?orgId=${orgId}&skipVerification=true`,
        {}
      );
      if (response.status === 200) {
        successToast("Subdomain created successfully", 1300);
        setSubdomainStatus({
          status: "pending",
          message: "Subdomain created. Verification can be done later.",
          loading: false,
        });
        // Don't reload - just update the UI state
        // The subdomain record has been created, but organization.companySlug might not reflect the new value yet
        // Don't trigger domain saves, just finish this operation
      }
    } catch (err: any) {
      console.error("Subdomain save failed", err);
      const errorMessage =
        err?.response?.data?.message || "Failed to save subdomain";
      errorToast(errorMessage, 1300);
      setSubdomainStatus({
        status: "error",
        message: errorMessage,
        loading: false,
      });
    }
  };

  const fetchMailgunDnsRecords = async (domain: string, orgId: string) => {
    setRecordsModalLoading(true);
    try {
      const res = await api.get(
        `/api/mailgun-module/fetch-dns-records?orgId=${orgId}&domain=${encodeURIComponent(
          domain
        )}`
      );
      const records = Array.isArray(res.data?.records) ? res.data.records : [];
      setRecordsModalDomain(domain);
      setRecordsModalRecords(records);
      setRecordsModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch DNS records", err);
      errorToast("Failed to fetch DNS records", 1300);
    } finally {
      setRecordsModalLoading(false);
    }
  };

  const handleVerifyStatus = async () => {
    const orgId = getEffectiveOrgId();
    if (!orgId) return;
    setRecordsModalVerifying(true);
    try {
      const res = await api.get(
        `/api/mailgun-module/fetch-domain-status?orgId=${orgId}`
      );
      if (res.status === 200 && res.data) {
        setSubdomainStatus({
          status: res.data.status,
          message: res.data.message,
          loading: false,
        });
      }
    } catch (err) {
      console.error("Failed to check status", err);
      errorToast("Failed to check status", 1300);
    } finally {
      setRecordsModalVerifying(false);
    }
  };

  const saveDomain = async (domain: string, index: number) => {
    const cleanDomain = (domain || "").trim();
    if (!cleanDomain) {
      errorToast("Enter a domain first", 1300);
      return;
    }

    // Validate domain format
    if (!isValidDomainFormat(cleanDomain)) {
      errorToast("Invalid domain format. Example: example.com", 1300);
      return;
    }

    const orgId = getEffectiveOrgId();
    if (!orgId) {
      errorToast("Save organization first", 1300);
      return;
    }

    setDomainButtonStates((prev) => ({ ...prev, [index]: "loading" }));

    try {
      const response = await api.post(
        `/api/mailgun-module/add-domain?orgId=${orgId}`,
        { domain: cleanDomain }
      );

      // Check for specific error messages from the API
      if (response.data?.error) {
        errorToast(response.data.error, 1300);
        setDomainButtonStates((prev) => ({ ...prev, [index]: "save" }));
        return;
      }

      setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
      await fetchMailgunDnsRecords(cleanDomain, orgId);
    } catch (err: any) {
      console.error("Domain save failed", err);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to save domain";
      errorToast(errorMsg, 1300);
      setDomainButtonStates((prev) => ({ ...prev, [index]: "save" }));
    }
  };

  const viewDomain = async (domain: string, index: number) => {
    const cleanDomain = (domain || "").trim();
    if (!cleanDomain) {
      errorToast("Enter a domain first", 1300);
      return;
    }

    const orgId = getEffectiveOrgId();
    if (!orgId) {
      errorToast("Save organization first", 1300);
      return;
    }

    setDomainButtonStates((prev) => ({ ...prev, [index]: "loading" }));

    try {
      await fetchMailgunDnsRecords(cleanDomain, orgId);
      setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
    } catch (err) {
      console.error("Failed to view domain", err);
      errorToast("Failed to load records", 1300);
      setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
    }
  };

  const saveOrganization = async (action: string) => {
    setShowSaveModal("");
    const userInfoSlice = {
      image: user.image,
      name: user.name,
      email: user.email,
    };
    if (action === "save") {
      const organizationData = {
        name,
        description,
        status,
        organizationType: "enterprise",
        image: "",
        coverImage: "",
        members,
        planId: organizationPlan?._id,
        extraJobSlots: isNaN(Number(extraJobSlots)) ? 0 : Number(extraJobSlots),
        projectsEnabled,
        guestPortalEnabled,
        country,
        province,
        city,
        address,
        companySlug,
        companyDomains: companyDomains
          .map((d) => (d || "").trim())
          .filter((d) => d.length > 0),
        lastEditedBy: userInfoSlice,
        createdBy: userInfoSlice,
        documents: [],
      };
      try {
        setIsSavingOrganization(true);
        const response = await api.post(
          "/api/admin/add-organization",
          organizationData
        );
        if (response.status === 200) {
          // Trigger subdomain creation in background without blocking
          if (companySlug && companySlug.trim().length > 0) {
            api
              .post("/api/mailgun-module/add-subdomain", {
                orgId: response.data.orgID,
              })
              .catch((subdomainError) => {
                console.error("Error provisioning subdomain:", subdomainError);
              });
          }

          // Process company domains in the background after organization is created
          const cleanedDomains = companyDomains
            .map((d) => (d || "").trim())
            .filter((d) => d.length > 0);
          if (Array.isArray(cleanedDomains) && cleanedDomains.length > 0) {
            Promise.all(
              cleanedDomains.map((domain) =>
                api
                  .post(
                    `/api/mailgun-module/add-domain?orgId=${response.data.orgID}`,
                    { domain }
                  )
                  .catch((domainError) => {
                    console.error(
                      `Error adding domain ${domain}:`,
                      domainError
                    );
                  })
              )
            );
          }

          const imageUrl =
            image && typeof image === "object"
              ? await uploadFile(
                  image as File,
                  `organization/profile-image/${response.data.orgID}.${
                    (image as File).type.split("/")[1]
                  }`
                )
              : null;
          const coverImageUrl =
            coverImage && typeof coverImage === "object"
              ? await uploadFile(
                  coverImage as File,
                  `organization/cover-image/${response.data.orgID}.${
                    (coverImage as File).type.split("/")[1]
                  }`
                )
              : null;
          const businessPermitUrl =
            businessPermitFile && typeof businessPermitFile === "object"
              ? await uploadFile(
                  businessPermitFile as File,
                  `organization/documents/business-permit/${
                    response.data.orgID
                  }.${(businessPermitFile as File).type.split("/")[1]}`
                )
              : null;
          const companyRegistrationUrl =
            companyRegistrationFile &&
            typeof companyRegistrationFile === "object"
              ? await uploadFile(
                  companyRegistrationFile as File,
                  `organization/documents/company-registration/${
                    response.data.orgID
                  }.${(companyRegistrationFile as File).type.split("/")[1]}`
                )
              : null;
          const documents = [];
          if (businessPermitUrl) {
            documents.push({
              name: "Business Permit",
              filename: (businessPermitFile as File)?.name,
              filePath: businessPermitUrl,
              fileType: (businessPermitFile as File).type.split("/")[1],
            });
          }
          if (companyRegistrationUrl) {
            documents.push({
              name: "Company/SEC Registration",
              filename: (companyRegistrationFile as File)?.name,
              filePath: companyRegistrationUrl,
              fileType: (companyRegistrationFile as File).type.split("/")[1],
            });
          }
          await api.post("/api/admin/update-organization", {
            orgID: response.data.orgID,
            update: {
              image: imageUrl ? `https://cdn.hellojia.ai/${imageUrl}` : "",
              coverImage: coverImageUrl
                ? `https://cdn.hellojia.ai/${coverImageUrl}`
                : "",
              documents,
            },
          });
          candidateActionToast(
            "Organization created successfully",
            1300,
            <i className="la la-check-circle text-success"></i>
          );
          setTimeout(() => {
            window.location.href = "/admin-portal/organizations";
          }, 1300);
        }
      } catch (error) {
        console.error("Error saving organization:", error);
        errorToast("Error saving organization", 1300);
      } finally {
        setIsSavingOrganization(false);
      }
    }

    if (action === "update") {
      const update: any = {
        name,
        description,
        status,
        planId: organizationPlan?._id,
        extraJobSlots: isNaN(Number(extraJobSlots)) ? 0 : Number(extraJobSlots),
        projectsEnabled,
        guestPortalEnabled,
        country,
        province,
        city,
        address,
        companySlug,
        companyDomains: companyDomains
          .map((d) => (d || "").trim())
          .filter((d) => d.length > 0),
        lastEditedBy: userInfoSlice,
        documents: [],
      };
      const replaceFiles = [];
      try {
        setIsSavingOrganization(true);
        if (image) {
          let imageURL = image;
          if (typeof image === "object") {
            const profileImageId = `${organization._id}-${new Date().getTime()}`;
            const uploadedPath = await uploadFile(
              image as File,
              `organization/profile-image/${profileImageId}.${
                (image as File).type.split("/")[1]
              }`
            );
            imageURL = uploadedPath
              ? `https://cdn.hellojia.ai/${uploadedPath}`
              : organization.image;
            if (uploadedPath) {
              replaceFiles.push(organization.image);
            }
          }
          update.image = imageURL;
        }
        if (coverImage) {
          let coverImageURL = coverImage;
          if (typeof coverImage === "object") {
            const coverImageId = `${organization._id}-${new Date().getTime()}`;
            const uploadedPath = await uploadFile(
              coverImage as File,
              `organization/cover-image/${coverImageId}.${
                (coverImage as File).type.split("/")[1]
              }`
            );
            coverImageURL = uploadedPath
              ? `https://cdn.hellojia.ai/${uploadedPath}`
              : organization.coverImage;
            if (uploadedPath) {
              replaceFiles.push(organization.coverImage);
            }
          }
          update.coverImage = coverImageURL;
        }
        if (businessPermitFile) {
          let document = organization.documents?.find(
            (d: any) => d.name === "Business Permit"
          );
          // New file was uploaded
          if (typeof businessPermitFile === "object") {
            const businessPermitId = `${organization._id}-${new Date().getTime()}`;
            const uploadedPath = await uploadFile(
              businessPermitFile as File,
              `organization/documents/business-permit/${businessPermitId}.${
                (businessPermitFile as File).type.split("/")[1]
              }`
            );
            if (uploadedPath && document?.filePath) {
              replaceFiles.push(document.filePath);
            }
            if (uploadedPath) {
              document = {
                name: "Business Permit",
                filename: (businessPermitFile as File)?.name,
                filePath: uploadedPath,
                fileType: (businessPermitFile as File).type.split("/")[1],
              };
            }
          }
          update.documents.push(document);
        }
        if (companyRegistrationFile) {
          let document = organization.documents?.find(
            (d: any) => d.name === "Company/SEC Registration"
          );
          // New file was uploaded
          if (typeof companyRegistrationFile === "object") {
            const companyRegistrationId = `${organization._id}-${new Date().getTime()}`;
            const uploadedPath = await uploadFile(
              companyRegistrationFile as File,
              `organization/documents/company-registration/${
                companyRegistrationId
              }.${(companyRegistrationFile as File).type.split("/")[1]}`
            );
            if (uploadedPath && document?.filePath) {
              replaceFiles.push(document.filePath);
            }
            if (uploadedPath) {
              document = {
                name: "Company/SEC Registration",
                filename: (companyRegistrationFile as File)?.name,
                filePath: uploadedPath,
                fileType: (companyRegistrationFile as File).type.split("/")[1],
              };
            }
          }
          update.documents.push(document);
        }
        const response = await api.post("/api/admin/update-organization", {
          orgID: organization._id,
          update,
          members,
          replaceFiles,
        });
        if (response.status === 200) {
          // Trigger subdomain creation in background if slug exists and wasn't set before
          if (
            companySlug &&
            companySlug.trim().length > 0 &&
            !organization?.companySlug
          ) {
            api
              .post("/api/mailgun-module/add-subdomain", {
                orgId: organization._id,
              })
              .catch((subdomainError) => {
                console.error("Error provisioning subdomain:", subdomainError);
              });
          }

          // Process company domains in the background
          const cleanedDomains = companyDomains
            .map((d) => (d || "").trim())
            .filter((d) => d.length > 0);
          const existingDomains = organization?.companyDomains || [];
          const newDomains = cleanedDomains.filter(
            (d) => !existingDomains.includes(d)
          );

          if (Array.isArray(newDomains) && newDomains.length > 0) {
            Promise.all(
              newDomains.map((domain) =>
                api
                  .post(
                    `/api/mailgun-module/add-domain?orgId=${organization._id}`,
                    { domain }
                  )
                  .catch((domainError) => {
                    console.error(
                      `Error adding domain ${domain}:`,
                      domainError
                    );
                  })
              )
            );
          }

          candidateActionToast(
            "Organization updated successfully",
            1300,
            <i className="la la-check-circle text-success"></i>
          );
        }
        setTimeout(() => {
          window.location.href = "/admin-portal/organizations";
        }, 1300);
      } catch (error) {
        console.error("Error updating organization:", error);
        errorToast("Error updating organization", 1300);
      } finally {
        setIsSavingOrganization(false);
      }
    }
  };

  useEffect(() => {
    const parseProvinces = () => {
      setProvinceList(philippineCitiesAndProvinces.provinces);
      const defaultProvince = philippineCitiesAndProvinces.provinces[0];
      if (!organization?.province) {
        setProvince(defaultProvince.name);
      }
      const cities = philippineCitiesAndProvinces.cities.filter(
        (city) => city.province === defaultProvince.key
      );
      setCityList(cities);
      if (!organization?.city) {
        setCity(cities[0].name);
      }
    };
    parseProvinces();
  }, [organization]);

  useEffect(() => {
    const fetchOrganizationPlans = async () => {
      try {
        const response = await api.get("/api/admin/get-organization-plan");
        if (response.status === 200) {
          // Check for current plan using new plan ID fields
          const currentPlanId = organization?.creditBasedPlanId || organization?.premiumPlanId;
          const currentPlan = currentPlanId
            ? response.data.find((plan: any) => plan._id === currentPlanId)
            : null;
          setOrganizationPlan(currentPlan || response.data[0]);
          setOrganizationPlanList(response.data);
        }
      } catch (error) {
        console.error("Error fetching organization plans:", error);
        errorToast("Error fetching organization plans", 1300);
      }
    };
    fetchOrganizationPlans();
  }, []);

  return (
    <div className="col">
      {formType === "add" ? (
        <div
          style={{
            marginBottom: "35px",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}>
            Add new organization
          </h1>

          <Button
            disabled={!isFormValid() || isSavingOrganization}
            variant="primary"
            onClick={() => {
              setShowSaveModal("save");
            }}
            icon="/circle-check.svg"
            label="Save Organization"
            >
          </Button>
        </div>
      ) : (
        <div
          style={{
            marginBottom: "35px",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}>
            Edit organization
          </h1>

          <Button
            disabled={!isFormValid() || isSavingOrganization}
            variant="primary"
            onClick={() => {
              setShowSaveModal("update");
            }}
            icon="/circle-check.svg"
            label="Save Organization"
          >
          </Button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          width: "100%",
          gap: 16,
          alignItems: "flex-start",
          marginTop: 16,
        }}
      >
        <div
          style={{
            width: "60%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
              marginBottom: "90px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: coverImage
                  ? "transparent"
                  : "linear-gradient(to right, #9FCAED, #CEB6DA, #EBACC9, #FCCEC0)",
                borderRadius: "20px",
                border: "1px solid #E9EAEB",
                minHeight: "194px",
              }}
            >
              {coverImage && (
                <img
                  src={
                    typeof coverImage === "string"
                      ? coverImage
                      : typeof coverImage === "object"
                      ? URL.createObjectURL(coverImage)
                      : null
                  }
                  id="cover-img"
                  alt="Cover Image"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                />
              )}
              <form>
                <input
                  type="file"
                  id="coverImage"
                  accept="image/jpeg, image/png, image/jpg"
                  hidden
                  onChange={(e) => {
                    if (
                      e.target instanceof HTMLInputElement &&
                      e.target.files?.[0]
                    ) {
                      const file = e.target.files[0];

                      if (!validateFile(file)) {
                        // Remove the file from the input
                        e.target.value = "";
                        return;
                      }

                      setCoverImage(file);
                      // set image to the img tag
                      document
                        .getElementById("cover-img")
                        ?.setAttribute("src", URL.createObjectURL(file));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  style={{
                    marginTop: 16,
                    position: "absolute",
                    top: 0,
                    right: 16,
                    zIndex: 2,
                  }}
                  onClick={() => {
                    document.getElementById("coverImage")?.click();
                  }}
                  label="Add cover image"
                   icon="/iconsV3/upload.svg"
                >
                </Button>
              </form>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                width: "100%",
                gap: 16,
                position: "absolute",
                bottom: -90,
                right: 0,
                zIndex: 2,
              }}
            >
              <img
                src={
                  image && typeof image === "string"
                    ? image
                    : image && typeof image === "object"
                    ? URL.createObjectURL(image)
                    : "/user-profile.png"
                }
                id="photo-img"
                alt="Organization"
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "1px solid #E9EAEB",
                  background: "#F8F9FC",
                }}
              />
              <form>
                <input
                  type="file"
                  id="photo"
                  accept="image/jpeg, image/png, image/jpg"
                  hidden
                  onChange={(e) => {
                    if (
                      e.target instanceof HTMLInputElement &&
                      e.target.files?.[0]
                    ) {
                      const file = e.target.files[0];
                      if (!validateFile(file)) {
                        // Remove the file from the input
                        e.target.value = "";
                        return;
                      }
                      setImage(file);
                      // set image to the img tag
                      document
                        .getElementById("photo-img")
                        ?.setAttribute("src", URL.createObjectURL(file));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    document.getElementById("photo")?.click();
                  }}
                  label="Upload photo"
                  icon="/iconsV3/upload.svg"
                >
                  
                </Button>
              </form>
            </div>
          </div>
          <div className="layered-card-outer">
            <div className="layered-card-middle">
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#181D27",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-suitcase"
                    style={{ color: "#FFFFFF", fontSize: 20 }}
                  ></i>
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Organization Information
                </span>
              </div>
              <div className="layered-card-content">
                <span>Organization Name</span>
                <input
                  value={name}
                  className="form-control"
                  placeholder="Enter company name"
                  onChange={(e) => {
                    setName(e.target.value || "");
                  }}
                ></input>
                <span>Description</span>
                <RichTextEditor
                  setText={setDescription}
                  text={description}
                  error={false}
                />
              </div>
            </div>
          </div>

          <div className="layered-card-outer">
            <div className="layered-card-middle">
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#181D27",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-users"
                    style={{ color: "#FFFFFF", fontSize: 20 }}
                  ></i>
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Members
                </span>
              </div>
              <div className="layered-card-content">
                <span>
                  Add members to automatically send them an email invitation to
                  Jia.
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    width: "100%",
                    marginTop: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      width: "50%",
                      alignItems: "flex-start",
                    }}
                  >
                    <span>Email</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      width: "50%",
                      alignItems: "flex-start",
                    }}
                  >
                    <span>Role</span>
                  </div>
                </div>
                {/* Array of form fields for each member */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    width: "100%",
                    marginTop: 16,
                  }}
                >
                  {members.map((member, index) => (
                    <div key={index}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                          gap: 16,
                        }}
                      >
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter email"
                          value={member.email}
                          onChange={(e) => {
                            const newMembers = [...members];
                            newMembers[index].email = e.target.value;
                            newMembers[index].error = validateMemberEmail(
                              e.target.value,
                              index
                            );
                            setMembers(newMembers);
                          }}
                        />
                        <CustomDropdown
                          onSelectSetting={(role) => {
                            const newMembers = [...members];
                            newMembers[index].role = role;
                            setMembers(newMembers);
                          }}
                          placeholder="Select Role"
                          screeningSetting={member.role}
                          settingList={roleList}
                        />
                        <div
                          onClick={() => {
                            const newMembers = [...members];
                            newMembers.splice(index, 1);
                            setMembers(newMembers);
                          }}
                        >
                          <i
                            className="la la-trash"
                            style={{
                              fontSize: 32,
                              marginRight: 8,
                              cursor: "pointer",
                            }}
                          ></i>
                        </div>
                      </div>
                      {member.error && (
                        <p className="text-danger">{member.error}</p>
                      )}
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="secondary"
                    style={{
                      // color: "#414651",
                      // background: "#FFFFFF",
                      width: "fit-content",
                      marginTop: 16,
                    }}
                    onClick={() => {
                      setMembers((prev) => [
                        ...prev,
                        {
                          email: "",
                          role: "",
                        },
                      ]);
                    }}
                    label="Add more lines"
                    icon="/plus-black.svg"
                  >
                    {/* <span>
                      <i
                        className="la la-plus-circle"
                        style={{ fontSize: 17, marginRight: 8 }}
                      ></i>
                      Add more lines
                    </span> */}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            width: "40%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div className="layered-card-outer" style={{ marginTop: 0 }}>
            <div className="layered-card-middle">
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#181D27",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-cog"
                    style={{ color: "#FFFFFF", fontSize: 20 }}
                  ></i>
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Settings
                </span>
              </div>
              <div className="layered-card-content">
                <span>Enable organization’s access to Jia</span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>Status</span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <OrganizationStatus status={status} />
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={status === "active"}
                        onChange={() =>
                          setStatus(status === "active" ? "inactive" : "active")
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>

                <span>Job Limit</span>
                <CustomDropdown
                  onSelectSetting={(plan) => {
                    const selectedPlan = organizationPlanList.find(
                      (p) => p.name === plan
                    );
                    setOrganizationPlan(selectedPlan || null);
                  }}
                  screeningSetting={organizationPlan?.name || ""}
                  settingList={organizationPlanList}
                />

                <span>Extra Job Slots</span>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Add numeric value"
                  min={0}
                  value={extraJobSlots}
                  onChange={(e) => {
                    setExtraJobSlots(e.target.value || "");
                  }}
                />

                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <span
                    style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                  >
                    Additional Features
                  </span>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>Projects</span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <OrganizationStatus
                        status={projectsEnabled ? "active" : "inactive"}
                      />
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={projectsEnabled}
                          onChange={() => setProjectsEnabled(!projectsEnabled)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>Requisitions</span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <OrganizationStatus
                        status={guestPortalEnabled ? "active" : "inactive"}
                      />
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={guestPortalEnabled}
                          onChange={() =>
                            setGuestPortalEnabled(!guestPortalEnabled)
                          }
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="layered-card-outer">
            <div className="layered-card-middle">
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#181D27",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-envelope"
                    style={{ color: "#FFFFFF", fontSize: 20 }}
                  ></i>
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Email Domain
                </span>
              </div>
              <div className="layered-card-content">
                <span style={{ marginBottom: 8 }}>
                  Create Jia email subdomain (eg. orgname.hellojia.ai)
                </span>
                <span>Company Slug (eg. orgname)</span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    className="form-control"
                    placeholder="Enter company slug"
                    value={companySlug}
                    onChange={(e) => {
                      setCompanySlug(e.target.value || "");
                    }}
                    disabled={!!organization?.companySlug}
                  />
                  {formType !== "add" && (
                    <>
                      {organization?.companySlug ? (
                        <Button
                          type="button"
                          variant="primary"
                          style={{
                            width: "fit-content",
                            whiteSpace: "nowrap",
                          }}
                          onClick={fetchSubdomainStatus}
                          disabled={subdomainStatus?.loading}
                          label={subdomainStatus?.loading ? "Checking..." : "Check status"}
                          icon={subdomainStatus?.loading ? "/loading-spinner.svg" : "/circle-check.svg"}
                        >
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          style={{
                            width: "fit-content",
                          }}
                          onClick={saveSubdomain}
                          disabled={!companySlug.trim() || subdomainStatus?.loading}
                          label={subdomainStatus?.loading ? "Saving..." : "Save"}
                          icon={subdomainStatus?.loading ? "/loading-spinner.svg" : "/save-white.svg"}
                        >
                        </Button>
                      )}
                    </>
                  )}
                </div>
                {subdomainStatus && !subdomainStatus.loading && (
                  <span
                    style={{
                      fontSize: 14,
                      color:
                        subdomainStatus.status === "active"
                          ? "#10B981"
                          : subdomainStatus.status === "unverified" ||
                            subdomainStatus.status === "pending"
                          ? "#F59E0B"
                          : subdomainStatus.status === "disabled" ||
                            subdomainStatus.status === "error"
                          ? "#EF4444"
                          : "#6B7280",
                      fontWeight: 500,
                      marginTop: 8,
                    }}
                  >
                    {subdomainStatus.message}
                  </span>
                )}
                {!organization?.companySlug && (
                  <span style={{ fontSize: 12 }}>
                    This can only be set once, it cannot be edited after
                    creation.
                  </span>
                )}

                <div
                  style={{
                    width: "100%",
                    height: 1,
                    background: "#E9EAEB",
                    marginTop: 16,
                    marginBottom: 16,
                  }}
                ></div>
                <span style={{ marginBottom: 8 }}>
                  Add existing company domain(s)
                </span>
                <span>Company Domain (eg. company.com)</span>
                {companyDomains.map((domain, index) => {
                  const cleanDomain = (domain || "").trim();
                  const domainExistsInOrg =
                    organization?.companyDomains &&
                    Array.isArray(organization.companyDomains) &&
                    organization.companyDomains.includes(cleanDomain);
                  const buttonState =
                    domainButtonStates[index] ||
                    (domainExistsInOrg ? "view" : "save");
                  const isLoading = buttonState === "loading";
                  const isDeleting = buttonState === "deleting";

                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <input
                        className="form-control"
                        placeholder="Enter company domain"
                        value={domain}
                        onChange={(e) => {
                          const newDomains = [...companyDomains];
                          newDomains[index] = e.target.value || "";
                          setCompanyDomains(newDomains);
                        }}
                      />
                      {formType !== "add" && (
                        <>
                          {isDeleting ? (
                            <Button
                              type="button"
                              variant="secondary"
                              style={{
                                width: "fit-content",
                              }}
                              onClick={() => {}}
                              disabled={true}
                              label="Deleting..."
                              icon="/loading-spinner.svg"
                            >
                            </Button>
                          ) : domainExistsInOrg || buttonState === "view" ? (
                            <Button
                              type="button"
                              variant="primary"
                              style={{
                                width: "fit-content",
                              }}
                              onClick={() => viewDomain(domain, index)}
                              disabled={isLoading}
                              label={isLoading ? "Loading..." : "View records"}
                              icon={isLoading ? "/loading-spinner.svg" : "/eye.svg"}
                            >
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="primary"
                              style={{
                                width: "fit-content",
                              }}
                              onClick={() => saveDomain(domain, index)}
                              disabled={isLoading}
                              label={isLoading ? "Saving..." : "Save"}
                              icon={isLoading ? "/loading-spinner.svg" : "/save-white.svg"}
                            >
                            </Button>
                          )}
                        </>
                      )}
                      <div
                        onClick={async () => {
                          const cleanDomain = (domain || "").trim();
                          const domainExistsInOrg =
                            organization?.companyDomains &&
                            Array.isArray(organization.companyDomains) &&
                            organization.companyDomains.includes(cleanDomain);
                          const buttonState = domainButtonStates[index];
                          const domainWasSaved =
                            domainExistsInOrg || buttonState === "view";

                          // If domain exists in org or was just saved, and is not empty, call delete API
                          if (
                            formType !== "add" &&
                            domainWasSaved &&
                            cleanDomain
                          ) {
                            const result = await Swal.fire({
                              icon: "warning",
                              title: "Delete Domain?",
                              text: `Are you sure you want to delete ${cleanDomain}? This action cannot be undone.`,
                              showCancelButton: true,
                              confirmButtonText: "Yes, delete it",
                              cancelButtonText: "Cancel",
                              confirmButtonColor: "#ef4444",
                              cancelButtonColor: "#6b7280",
                              focusCancel: true,
                            });

                            if (!result.isConfirmed) return;

                            // Set button state to deleting
                            setDomainButtonStates((prev) => ({
                              ...prev,
                              [index]: "deleting",
                            }));

                            try {
                              const response = await api.post(
                                `/api/mailgun-module/delete-domain?orgId=${organization._id}`,
                                { domain: cleanDomain }
                              );

                              if (response.status === 200) {
                                candidateActionToast(
                                  "Domain deleted successfully",
                                  1300,
                                  <i className="la la-check-circle text-success"></i>
                                );
                                // Refresh the page to reflect changes
                                setTimeout(() => {
                                  window.location.reload();
                                }, 1300);
                              }
                            } catch (err) {
                              console.error("Failed to delete domain", err);
                              errorToast("Failed to delete domain", 1300);
                              // Reset button state on error
                              setDomainButtonStates((prev) => ({
                                ...prev,
                                [index]: "view",
                              }));
                            }
                          } else {
                            // Just remove from local state if not saved yet
                            setCompanyDomains((prev) => {
                              const next = prev.filter((_, i) => i !== index);
                              // Keep at least one empty field
                              return next.length > 0 ? next : [""];
                            });
                          }
                        }}
                      >
                        <i
                          className="la la-trash"
                          style={{
                            fontSize: 32,
                            marginRight: 8,
                            cursor: "pointer",
                          }}
                        ></i>
                      </div>
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="secondary"
                  style={{
                    width: "fit-content",
                    marginTop: 16,
                    opacity: companyDomains.length >= 5 ? 0.5 : 1,
                    cursor:
                      companyDomains.length >= 5 ? "not-allowed" : "pointer",
                  }}
                  onClick={() => {
                    if (companyDomains.length < 5) {
                      setCompanyDomains((prev) => [...prev, ""]);
                    }
                  }}
                  disabled={companyDomains.length >= 5}
                  label={`Add domain ${companyDomains.length >= 5 ? "(max 5)" : ""}`}
                  icon="/plus-black.svg"
                >
                </Button>
              </div>
            </div>
          </div>

          <div className="layered-card-outer">
            <div className="layered-card-middle">
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#181D27",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-ellipsis-h"
                    style={{ color: "#FFFFFF", fontSize: 20 }}
                  ></i>
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Business Details
                </span>
              </div>
              <div className="layered-card-content">
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Documents
                </span>
                <span>Company/Sec Registration</span>
                <form>
                  <input
                    type="file"
                    id="companyRegistration"
                    accept="application/pdf, image/jpeg, image/png, image/jpg"
                    hidden
                    onChange={(e) => {
                      if (
                        e.target instanceof HTMLInputElement &&
                        e.target.files
                      ) {
                        const file = e.target.files[0];
                        if (!validateFile(file)) {
                          // Remove the file from the input
                          e.target.value = "";
                          return;
                        }
                        setCompanyRegistrationFile(file);
                      }
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      style={{
                        maxWidth: "300px",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => {
                        document.getElementById("companyRegistration")?.click();
                      }}
                      label={companyRegistrationFile ? (
                        typeof companyRegistrationFile === "string" ? (
                          companyRegistrationFile
                        ) : (
                          companyRegistrationFile?.name
                        )
                      ) : "Upload Document"}
                      icon={companyRegistrationFile ? "" : "/plus-black.svg"}
                    >
                    </Button>
                    {companyRegistrationFile && (
                      <div
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          const form = document.getElementById(
                            "companyRegistration"
                          ) as HTMLInputElement;
                          if (form) {
                            form.value = "";
                          }
                          setCompanyRegistrationFile(null);
                        }}
                      >
                        <i
                          className="la la-times"
                          style={{ fontSize: 17, marginRight: 8 }}
                        ></i>
                      </div>
                    )}
                  </div>
                </form>
                <span>Business Permit</span>
                <form>
                  <input
                    type="file"
                    id="businessPermit"
                    accept="application/pdf, image/jpeg, image/png, image/jpg"
                    hidden
                    onChange={(e) => {
                      if (
                        e.target instanceof HTMLInputElement &&
                        e.target.files
                      ) {
                        const file = e.target.files[0];
                        if (!validateFile(file)) {
                          // Remove the file from the input
                          e.target.value = "";
                          return;
                        }
                        setBusinessPermitFile(file);
                      }
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      style={{
                        maxWidth: "300px",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => {
                        document.getElementById("businessPermit")?.click();
                      }}
                      label={businessPermitFile ? (
                        typeof businessPermitFile === "string" ? (
                          businessPermitFile
                        ) : (
                          businessPermitFile?.name
                        )) : "Upload Document"}
                      icon={businessPermitFile ? "" : "/plus-black.svg"}
                    >
                    </Button>
                    {businessPermitFile && (
                      <div
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          const form = document.getElementById(
                            "businessPermit"
                          ) as HTMLInputElement;
                          if (form) {
                            form.value = "";
                          }
                          setBusinessPermitFile(null);
                        }}
                      >
                        <i
                          className="la la-times"
                          style={{ fontSize: 17, marginRight: 8 }}
                        ></i>
                      </div>
                    )}
                  </div>
                </form>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Organization Address
                </span>

                <span>Country</span>
                <CustomDropdown
                  onSelectSetting={(setting) => {
                    setCountry(setting);
                  }}
                  screeningSetting={country}
                  settingList={[]}
                  placeholder="Select Country"
                />

                <span>State / Province</span>
                <CustomDropdown
                  onSelectSetting={(province) => {
                    setProvince(province);
                    const provinceObj = provinceList.find(
                      (p) => p.name === province
                    );
                    const cities = philippineCitiesAndProvinces.cities.filter(
                      (city) => city.province === provinceObj.key
                    );
                    setCityList(cities);
                    setCity(cities[0].name);
                  }}
                  screeningSetting={province}
                  settingList={provinceList}
                  placeholder="Select State / Province"
                />

                <span>City</span>
                <CustomDropdown
                  onSelectSetting={(city) => {
                    setCity(city);
                  }}
                  screeningSetting={city}
                  settingList={cityList}
                  placeholder="Select City"
                />

                <span>Address</span>
                <input
                  value={address}
                  className="form-control"
                  placeholder="Enter company address"
                  onChange={(e) => {
                    setAddress(e.target.value || "");
                  }}
                ></input>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DomainRecordsModal
        open={recordsModalOpen}
        domain={recordsModalDomain}
        records={recordsModalRecords}
        loading={recordsModalLoading}
        verifying={recordsModalVerifying}
        orgId={organization?._id}
        useFetchSubdomainStatus={true}
        onClose={() => setRecordsModalOpen(false)}
        onVerifyStatus={handleVerifyStatus}
      />
      {showSaveModal && (
        <OrganizationActionModal
          action={showSaveModal}
          onAction={(action) => saveOrganization(action)}
        />
      )}
      {isSavingOrganization && (
        <FullScreenLoadingAnimation
          title={
            formType === "add"
              ? "Saving organization..."
              : "Updating organization..."
          }
          subtext={`Please wait while we are ${
            formType === "add" ? "saving" : "updating"
          } the organization`}
        />
      )}
    </div>
  );
}
