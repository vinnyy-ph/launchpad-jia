"use client";

import styles from "./settings.module.scss";
import { Editor } from "@/lib/components/sections";
import { Button, Toggle } from "@/lib/components/ui";
import { getGmailScopeDescription } from "@/lib/data/googleScope";
import type { EmailSettingsProps } from "@/lib/types/email.type";
import axios from "axios";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AvatarImage from "../../AvatarImage/AvatarImage";

interface OnChangeProps {
  id: string;
  value: string;
}

const ConnectGmail = dynamic(
  () => import("@/lib/components/sections/modal/ConnectGmail"),
  { ssr: false, loading: () => null },
);

const Delete = dynamic(() => import("@/lib/components/sections/modal/Delete"), {
  ssr: false,
  loading: () => null,
});

type ActiveModal = "delete" | "delete-outlook" | "gmail" | null;

export default function () {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsProps | null>(
    null,
  );
  const [formdata, setFormdata] = useState<Record<string, string>>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isGmailLoading, setIsGmailLoading] = useState(false);
  const [isOutlookLoading, setOutlookLoading] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleConnection = useCallback(() => {
    if (!emailSettings) return;

    manageEmailSettings({
      ...emailSettings,
      connected: !emailSettings.connected,
    });
  }, [emailSettings]);

  const handleDeleteModal = useCallback(() => {
    setActiveModal("delete");
  }, []);

  const handleGmail = useCallback(() => {
    // TODO(Vince)
    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { token, orgID } = result;
    const height = 600;
    const width = 500;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const popup = window.open(
      `/api/auth/google?token=${encodeURIComponent(token)}&orgID=${orgID}`,
      "Connect Gmail",
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      alert("Popup blocked. Please allow popups and try again.");
      return;
    }

    setIsGmailLoading(true);

    let handled = false;

    function onMessage(e: MessageEvent) {
      if (e.origin != window.location.origin) return;

      const { type, clientPayload } = e.data;

      if (type === "GOOGLE_OAUTH_PAYLOAD" && clientPayload) {
        handled = true;

        if (popup && !popup.closed) {
          popup.close();
        }

        cleanup();
        setActiveModal(null);
        setEmailSettings(
          (prev) =>
            ({ ...(prev || {}), ...clientPayload }) as EmailSettingsProps,
        );
        setIsGmailLoading(false);
      }
    }

    function cleanup() {
      window.removeEventListener("message", onMessage);
      if (interval) clearInterval(interval);
    }

    window.addEventListener("message", onMessage);

    const interval = setInterval(() => {
      if (!popup || popup.closed) {
        if (!handled) {
          setIsGmailLoading(false);
        }
        cleanup();
      }
    }, 500);
  }, []);

  const handleGmailModal = useCallback(() => {
    if (isGmailLoading) return;
    setActiveModal("gmail");
  }, [isGmailLoading]);

  const handleOutlook = useCallback(() => {
    const result = verify();
    if (typeof result === "string") {
      alert(result);
      return;
    }
    const { token, orgID } = result;
    const height = 600;
    const width = 500;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const popup = window.open(
      `/api/auth/microsoft?token=${encodeURIComponent(token)}&orgID=${orgID}`,
      "Connect Outlook",
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      alert("Popup blocked. Please allow popups and try again.");
      return;
    }

    setOutlookLoading(true);

    let handled = false;

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;

      const { type, clientPayload } = e.data;

      if (type === "MICROSOFT_OAUTH_PAYLOAD" && clientPayload) {
        handled = true;

        if (popup && !popup.closed) {
          popup.close();
        }

        cleanup();
        setActiveModal(null);
        setEmailSettings(
          (prev) =>
            ({ ...(prev || {}), ...clientPayload }) as EmailSettingsProps,
        );
        setOutlookLoading(false);
      }
    }

    function cleanup() {
      window.removeEventListener("message", onMessage);
      if (interval) clearInterval(interval);
    }

    window.addEventListener("message", onMessage);

    const interval = setInterval(() => {
      if (!popup || popup.closed) {
        if (!handled) setOutlookLoading(false);
        cleanup();
      }
    }, 500);
  }, []);

  const handleOnChange = useCallback(({ id, value }: OnChangeProps) => {
    setFormdata((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleRedirection = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", "user");

    const orgID =
      searchParams.get("orgID") || searchParams.get("orgId") || "";

    if (orgID) {
      params.set("orgID", orgID);
    }

    router.push(`${pathname}/email-templates?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const handleRefreshConnection = useCallback(() => {
    if (!emailSettings) return;

    manageEmailSettings({
      ...emailSettings,
      dateSync: new Date().toISOString(),
    });
  }, [emailSettings]);

  const handleResetChanges = useCallback(() => {
    setFormdata((prev) => ({
      ...prev,
      signature: emailSettings?.signature || "",
    }));

    setResetCount((prev) => prev + 1);
  }, [emailSettings]);

  const handleRevokeAccess = useCallback(() => {
    if (!emailSettings) return;

    manageEmailSettings({
      ...emailSettings,
      connected: null,
      dateSync: null,
      enableGmailSending: null,
      permission: null,
      preferGmail: null,
      signature: emailSettings?.signature || "",
      user: null,
    } as unknown as EmailSettingsProps);
    setActiveModal(null);
  }, [emailSettings]);

  const handleRevokeOutlookAccess = useCallback(() => {
    manageEmailSettings({
      ...emailSettings,
      outlookConnected: false,
      outlookTokens: null,
      outlookEmail: null,
      outlookDateSync: null,
      outlookUser: null,
      enableOutlookSending: null,
    } as unknown as EmailSettingsProps);
    setActiveModal(null);
  }, [emailSettings]);

  const toggleOutlookSending = useCallback(
    (checked: boolean) => {
      if (!emailSettings) return;

      manageEmailSettings({ ...emailSettings, enableOutlookSending: checked });
    },
    [emailSettings],
  );

  const handleOutlookDeleteModal = useCallback(() => {
    setActiveModal("delete-outlook");
  }, []);

  const handleRefreshOutlookConnection = useCallback(() => {
    if (!emailSettings) return;

    manageEmailSettings({
      ...emailSettings,
      outlookDateSync: new Date().toISOString(),
    });
  }, [emailSettings]);

  const handleSaveSignature = useCallback(() => {
    if (isInitialLoading) return;

    manageEmailSettings({
      ...(emailSettings || ({} as unknown as EmailSettingsProps)),
      signature: formdata.signature || "",
    });
  }, [formdata, emailSettings, isInitialLoading]);

  const toggleGmailSending = useCallback(
    (checked: boolean) => {
      if (!emailSettings) return;

      manageEmailSettings({ ...emailSettings, enableGmailSending: checked });
    },
    [emailSettings],
  );

  const togglePreference = useCallback(
    (checked: boolean) => {
      if (!emailSettings) return;

      manageEmailSettings({ ...emailSettings, preferGmail: checked });
    },
    [emailSettings],
  );

  function formatTimeAgo(date: string) {
    // TODO(Vince)
    const now = new Date();
    const past = new Date(date);
    const diff = now.getTime() - past.getTime();

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "Just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;

    const years = Math.floor(days / 365);
    return `${years} year${years !== 1 ? "s" : ""} ago`;
  }

  function verify() {
    const token = localStorage.getItem("authToken");
    if (!token) {
      return "Your session has expired. Please sign in again.";
    }

    const activeOrg = localStorage.getItem("activeOrg");
    if (!activeOrg) {
      return "Failed to load organization information. Please check your session.";
    }

    try {
      const parsedOrg = JSON.parse(activeOrg);
      if (!parsedOrg._id) {
        return "Failed to load organization information. Please check your session.";
      }

      return { token, orgID: parsedOrg._id };
    } catch (err) {
      return "Failed to load organization information. Please check your session.";
    }
  }

  useEffect(() => {
    fetchEmailSettings();
  }, []);

  function fetchEmailSettings() {
    // TODO(Vince)
    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { token, orgID } = result;

    axios({
      headers: {
        Authorization: token,
      },
      method: "GET",
      url: `/api/emails/settings?orgID=${orgID}`,
    })
      .then((res) => {
        const result = res.data.emailSettings as EmailSettingsProps;

        if (result) {
          if (result.signature) {
            setFormdata((prev) => ({ ...prev, signature: result.signature }));
            setResetCount((prev) => prev + 1);
          }

          setEmailSettings(result);
        }
      })
      .catch((err) => {
        alert(
          err?.response?.data?.error ||
            "An unexpected error occurred. Please try again later.",
        );
      })
      .finally(() => {
        setIsInitialLoading(false);
      });
  }

  function manageEmailSettings(data: EmailSettingsProps) {
    // TODO(Vince)
    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { token, orgID } = result;

    axios({
      data: { ...data, orgID },
      headers: { Authorization: token },
      method: "POST",
      url: "/api/emails/settings",
    })
      .then((res) => {
        setEmailSettings(data);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  return (
    <div className={styles.emailIntegration}>
      <ConnectGmail
        isVisible={activeModal == "gmail"}
        onClick={handleGmail}
        onClose={handleCloseModal}
      />

      <Delete
        description="Are you sure you want to revoke gmail access? This will stop email from being sent using your account."
        isVisible={activeModal == "delete"}
        label="Revoke Gmail Access"
        onClick={handleRevokeAccess}
        onClose={handleCloseModal}
      />

      <Delete
        description="Are you sure you want to revoke Outlook access? This will stop email from being sent using your Outlook account."
        isVisible={activeModal == "delete-outlook"}
        label="Revoke Outlook Access"
        onClick={handleRevokeOutlookAccess}
        onClose={handleCloseModal}
      />

      <div className={styles.header}>
        <span className={styles.label}>Email Settings & Integrations</span>
        <span className={styles.description}>
          Configure email templates, signature, and email integrations (Gmail,
          Outlook).
        </span>
      </div>

      <div className={`${styles.contentGroup} ${styles.first}`}>
        <div className={styles.textGroup}>
          <span className={styles.label}>Templates</span>
          <span className={styles.description}>
            Create, edit, and manage email templates.
          </span>
        </div>

        <Button
          icon="/icons/edit.svg"
          label="Manage email templates"
          onClick={handleRedirection}
        />
      </div>

      <div className={`${styles.contentGroup} ${styles.second}`}>
        <div className={styles.textGroup}>
          <span className={styles.label}>Signature</span>
          <span className={styles.description}>Edit your email signature.</span>
        </div>

        <div className={styles.editorGroup}>
          {isInitialLoading && <div className={styles.editorLoading} />}
          <Editor
            formdata={formdata}
            height={225}
            isLabelVisible={false}
            key={resetCount}
            label="Signature"
            placeholder="Enter signature"
            onChange={handleOnChange}
          />

          <div className={styles.buttonGroup}>
            <Button
              label="Reset Changes"
              disabled={
                isInitialLoading ||
                (formdata?.signature || "") == (emailSettings?.signature || "")
              }
              variant="secondary"
              onClick={handleResetChanges}
            />
            <Button
              label="Save"
              disabled={
                isInitialLoading ||
                (formdata?.signature || "") == (emailSettings?.signature || "")
              }
              onClick={handleSaveSignature}
            />
          </div>
        </div>
      </div>

      <div className={`${styles.contentGroup} ${styles.third}`}>
        <div className={styles.textGroup}>
          <span className={styles.label}>
            Gmail Integration
            <span
              className={
                emailSettings && emailSettings.connected ? styles.connected : ""
              }
            >
              <div />
              {emailSettings && emailSettings.connected
                ? "Connected"
                : "Not Connected"}
            </span>
          </span>

          <span className={styles.description}>
            Connect your Gmail account to send recruitment emails directly from
            your personal email address.
          </span>
        </div>

        {!emailSettings?.dateSync ? (
          <div className={styles.notConnectedState}>
            <div className={styles.icon}>
              <img alt="" src="/icons/mail.svg" />
            </div>

            <span className={styles.label}>Connect your Gmail Account</span>
            <span className={styles.description}>
              Send automated and custom emails directly from your Gmail account
              in Jia
            </span>

            <Button
              disabled={isGmailLoading}
              icon={isGmailLoading ? "/icons/loader.svg" : "/icons/link.svg"}
              label={isGmailLoading ? "Connecting" : "Connect Gmail"}
              onClick={handleGmailModal}
            />
          </div>
        ) : (
          <div className={styles.connectedState}>
            <div className={styles.userGroup}>
              <img
                alt=""
                className={styles.avatar}
                src={emailSettings.user.picture}
              />
              <div className={styles.userDetails}>
                <span className={styles.name}>{emailSettings.user.name}</span>
                <span className={styles.email}>{emailSettings.user.email}</span>
                <span className={styles.sync}>
                  Last sync: {formatTimeAgo(emailSettings.dateSync)}
                </span>
              </div>
              <Button
                icon={
                  emailSettings.connected
                    ? "/icons/link_off.svg"
                    : "/icons/link.svg"
                }
                label={emailSettings.connected ? "Disconnect" : "Connect"}
                variant={emailSettings.connected ? "secondary" : "primary"}
                onClick={handleConnection}
              />
            </div>

            <div className={`${styles.contentGroup} ${styles.fourth}`}>
              <div className={styles.textGroup}>
                <span className={styles.label}>Gmail Settings</span>
                <span className={styles.description}>
                  Configure how Gmail integration works with your recruitment
                  emails.
                </span>
              </div>

              <div className={styles.settingsGroup}>
                <div className={styles.toggleGroup}>
                  <Toggle
                    checked={emailSettings.enableGmailSending}
                    onChange={toggleGmailSending}
                  />
                  <div>
                    <span>Enable Gmail sending</span>
                    <span>Use Gmail to send recruitment emails</span>
                  </div>
                </div>

                <div className={styles.toggleGroup}>
                  <Toggle
                    checked={emailSettings.preferGmail}
                    onChange={togglePreference}
                  />
                  <div>
                    <span>Prefer Gmail over system email</span>
                    <span>Default to Gmail when composing emails</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${styles.contentGroup} ${styles.fourth}`}>
              <div className={styles.textGroup}>
                <span className={styles.label}>Security & Permissions</span>
                <span className={styles.description}>
                  Manage your Gmail integration permissions and security
                  settings.
                </span>
              </div>

              <div className={styles.permissionGroup}>
                <div className={styles.scopeGroup}>
                  <span className={styles.label}>Current Permissions</span>
                  {getGmailScopeDescription(emailSettings.permission).map(
                    (scope) => (
                      <span className={styles.scope} key={scope}>
                        <img alt="" src="/icons/checkmark.svg" />
                        {scope}
                      </span>
                    ),
                  )}
                </div>

                <div className={styles.noteGroup}>
                  <span className={styles.label}>Data Security</span>
                  <span className={styles.message}>
                    Your Gmail credentials are stored securely using OAuth 2.0.
                    We never store your password and you can revoke access at
                    any time.
                  </span>
                </div>

                <div className={styles.buttonGroup}>
                  <Button
                    icon="/icons/refresh.svg"
                    label="Refresh Connection"
                    variant="secondary"
                    onClick={handleRefreshConnection}
                  />
                  <Button
                    icon="/icons/link_off-2.svg"
                    label="Revoke Access"
                    variant="tertiary"
                    onClick={handleDeleteModal}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`${styles.contentGroup} ${styles.third}`}>
        <div className={styles.textGroup}>
          <span className={styles.label}>
            Outlook Integration
            <span
              className={
                emailSettings?.outlookConnected ? styles.connected : ""
              }
            >
              <div />
              {emailSettings?.outlookConnected ? "Connected" : "Not Connected"}
            </span>
          </span>
          <span className={styles.description}>
            Connect your Outlook account to send and manage recruitment emails
            from your Microsoft 365 email.
          </span>
        </div>

        {!emailSettings?.outlookConnected ? (
          <div className={styles.notConnectedState}>
            <div className={styles.icon}>
              <img alt="" src="/icons/mail.svg" />
            </div>
            <span className={styles.label}>Enable Outlook integration</span>
            <span className={styles.description}>
              Connect your Outlook account to use your Microsoft 365 email in
              Jia. You will be redirected to sign in with Microsoft.
            </span>
            <Button
              disabled={isOutlookLoading}
              icon={isOutlookLoading ? "/icons/loader.svg" : "/icons/link.svg"}
              label={
                isOutlookLoading ? "Connecting…" : "Enable Outlook integration"
              }
              onClick={handleOutlook}
            />
          </div>
        ) : (
          <div className={styles.connectedState}>
            <div className={styles.userGroup}>
              {emailSettings.outlookUser?.picture ? (
                <img
                  alt=""
                  className={styles.avatar}
                  src={emailSettings.outlookUser.picture}
                />
              ) : (
                <AvatarImage />
              )}
              <div className={styles.userDetails}>
                <span className={styles.name}>
                  {emailSettings.outlookUser?.name || "Outlook connected"}
                </span>
                <span className={styles.email}>
                  {emailSettings.outlookEmail}
                </span>
                {emailSettings.outlookDateSync && (
                  <span className={styles.sync}>
                    Last sync: {formatTimeAgo(emailSettings.outlookDateSync)}
                  </span>
                )}
              </div>
              <Button
                icon={
                  emailSettings.outlookConnected
                    ? "/icons/link_off.svg"
                    : "/icons/link.svg"
                }
                label={
                  emailSettings.outlookConnected ? "Disconnect" : "Connect"
                }
                variant={
                  emailSettings.outlookConnected ? "secondary" : "primary"
                }
                onClick={handleOutlookDeleteModal}
              />
            </div>

            <div className={`${styles.contentGroup} ${styles.fourth}`}>
              <div className={styles.textGroup}>
                <span className={styles.label}>Outlook Settings</span>
                <span className={styles.description}>
                  Configure how Outlook integration works with your recruitment
                  emails.
                </span>
              </div>

              <div className={styles.settingsGroup}>
                <div className={styles.toggleGroup}>
                  <Toggle
                    checked={emailSettings.enableOutlookSending}
                    onChange={toggleOutlookSending}
                  />
                  <div>
                    <span>Enable Outlook sending</span>
                    <span>Use Outlook to send recruitment emails</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${styles.contentGroup} ${styles.fourth}`}>
              <div className={styles.textGroup}>
                <span className={styles.label}>Security & Permissions</span>
                <span className={styles.description}>
                  Manage your Outlook integration permissions and security
                  settings.
                </span>
              </div>

              <div className={styles.permissionGroup}>
                <div className={styles.scopeGroup}>
                  <span className={styles.label}>Current Permissions</span>
                  <span className={styles.scope}>
                    <img alt="" src="/icons/checkmark.svg" />
                    Read and send Outlook email
                  </span>
                  <span className={styles.scope}>
                    <img alt="" src="/icons/checkmark.svg" />
                    Access your email address
                  </span>
                  <span className={styles.scope}>
                    <img alt="" src="/icons/checkmark.svg" />
                    Authenticate with Microsoft
                  </span>
                </div>

                <div className={styles.noteGroup}>
                  <span className={styles.label}>Data Security</span>
                  <span className={styles.message}>
                    Your Outlook credentials are stored securely using OAuth
                    2.0. We never store your password and you can revoke access
                    at any time.
                  </span>
                </div>

                <div className={styles.buttonGroup}>
                  <Button
                    icon="/icons/refresh.svg"
                    label="Refresh Connection"
                    variant="secondary"
                    onClick={handleRefreshOutlookConnection}
                  />
                  <Button
                    icon="/icons/link_off-2.svg"
                    label="Revoke Access"
                    variant="tertiary"
                    onClick={handleOutlookDeleteModal}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
