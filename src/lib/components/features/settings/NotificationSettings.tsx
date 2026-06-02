'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationPreferences } from '@/lib/utils/notificationHelpers';
import { errorToast, successToast } from '@/lib/Utils';
import { useNotifications } from '@/lib/context/NotificationContext';
import { useRecruiterContext } from '@/lib/context/RecruiterContext';
import { api } from '@/lib/utils/apiClient';
import { AlertOctagon } from '@untitledui/icons';
import styles from './NotificationSettings.module.scss';
import { Button } from '../../ui';
import Image from 'next/image';

export default function NotificationSettings() {
  const router = useRouter();
  const { subscribeToPush, unsubscribeFromPush, isPushEnabled } = useNotifications();
  const { setHasUnsavedChanges, modalType, setModalType } = useRecruiterContext();
  const [savedPreferences, setSavedPreferences] = useState<NotificationPreferences | null>(null);
  const [currentPreferences, setCurrentPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingTabNavigation, setPendingTabNavigation] = useState<(() => void) | null>(null);
  const [pendingSidebarUrl, setPendingSidebarUrl] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [isTogglingPush, setIsTogglingPush] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    if (!savedPreferences || !currentPreferences) return false;
    return JSON.stringify(savedPreferences) !== JSON.stringify(currentPreferences);
  }, [savedPreferences, currentPreferences]);

  // Sync unsaved state to RecruiterContext for navigation protection
  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
    return () => setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  // Watch for navigation attempts via context modal trigger
  useEffect(() => {
    if (modalType === 'inactive' && hasUnsavedChanges) {
      setShowUnsavedModal(true);
      setModalType(null);
    }
  }, [modalType, hasUnsavedChanges, setModalType]);

  // Listen for tab change attempts from Settings component
  useEffect(() => {
    const handleTabChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (hasUnsavedChanges) {
        setPendingTabNavigation(() => customEvent.detail.onConfirm);
        setShowUnsavedModal(true);
      } else {
        customEvent.detail.onConfirm();
      }
    };

    window.addEventListener('confirmTabChange', handleTabChange);
    return () => window.removeEventListener('confirmTabChange', handleTabChange);
  }, [hasUnsavedChanges]);

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  useEffect(() => {
    fetchPreferences();

    try {
      const activeOrg = localStorage.getItem('activeOrg');
      if (activeOrg) {
        const orgData = JSON.parse(activeOrg);
        setUserRole(orgData.role || 'user');
      }
    } catch (error) {
      console.error('Error reading role from localStorage:', error);
    }
  }, []);

  // Browser navigation protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Capture sidebar link clicks before SidebarV2's onClick handler
  useEffect(() => {
    const handleSidebarClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const link = target.closest('.sidebar-v2 a');
      if (!link) return;

      let href = link.getAttribute('href');
      if (!href) return;

      const linkUrl = new URL(href, window.location.origin);

      // Only preserve orgID parameter if not already in the link
      const currentParams = new URLSearchParams(window.location.search);
      const orgID = currentParams.get('orgID');
      if (orgID && !linkUrl.searchParams.has('orgID')) {
        linkUrl.searchParams.set('orgID', orgID);
      }

      setPendingSidebarUrl(linkUrl.pathname + linkUrl.search);
    };

    document.addEventListener('click', handleSidebarClick, true);
    return () => document.removeEventListener('click', handleSidebarClick, true);
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await api.get('/api/notifications/preferences');
      setSavedPreferences(response.data.preferences);
      setCurrentPreferences(response.data.preferences);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await api.post('/api/notifications/preferences', {
        preferences: currentPreferences,
      });
      setSavedPreferences(currentPreferences);
      successToast('Notification settings saved', 1200);
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setCurrentPreferences(savedPreferences);
  };

  const handleDiscardAndLeave = () => {
    setCurrentPreferences(savedPreferences);
    setShowUnsavedModal(false);
    setHasUnsavedChanges(false);

    if (pendingTabNavigation) {
      pendingTabNavigation();
      setPendingTabNavigation(null);
    }

    if (pendingSidebarUrl) {
      router.push(pendingSidebarUrl);
      setPendingSidebarUrl(null);
    }
  };

  const handleSaveAndLeave = async () => {
    await handleSave();
    setShowUnsavedModal(false);
    setHasUnsavedChanges(false);

    if (pendingTabNavigation) {
      pendingTabNavigation();
      setPendingTabNavigation(null);
    }

    if (pendingSidebarUrl) {
      router.push(pendingSidebarUrl);
      setPendingSidebarUrl(null);
    }
  };

  // Update handlers for each preference type
  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    if (!currentPreferences) return;
    setCurrentPreferences({
      ...currentPreferences,
      [key]: value,
    });
  };

  // Handle push notification toggle
  const handlePushToggle = async () => {
    setIsTogglingPush(true);
    try {
      if (isPushEnabled) {
        await unsubscribeFromPush();
        successToast('Push notifications disabled', 1200);
      } else {
        const result = await subscribeToPush();

        if (result.success) {
          successToast('Push notifications enabled', 1200);
        } else {
          // Handle different failure reasons
          if (result.reason === 'denied') {
            errorToast('Notifications are blocked. Enable them in your browser.', 2500);
          } else if (result.reason === 'dismissed') {
            errorToast('Notification permission was dismissed. Please try again.', 2500);
          } else if (result.reason === 'error') {
            errorToast(result.error || 'Failed to enable push notifications', 2500);
          }
        }
      }
    } catch (error: any) {
      errorToast(error.message || 'An unexpected error occurred', 2500);
    } finally {
      setIsTogglingPush(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={`${styles.loading} ${styles.loadingPanel}`}>
          <Image
            src="/gifs/analysis-loading.gif"
            alt="Loading"
            className={styles.loadingImage}
          />
          <span className={styles.loadingText}>Loading your notification preferences...</span>
        </div>
      </div>
    );
  }

  if (!currentPreferences) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load notification preferences</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <header>
          <h3>Notification Settings</h3>
          <p>We may still send you important notifications about your account outside of your notification settings.</p>
        </header>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={handleRevert}
            disabled={!hasUnsavedChanges || saving}
            label="Revert"
          >
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving}
            label={saving ? 'Saving...' : 'Save Changes'}
          >
          </Button>
        </div>
      </div>

      {/* Push Notifications Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Push Notifications</h4>
          <p>
            Enable browser push notifications to receive real-time alerts even when you're not using the app.
          </p>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={`${styles.checkboxOption} ${isTogglingPush ? styles.checkboxDisabled : ''}`}>
            <input
              type="checkbox"
              checked={isPushEnabled}
              onChange={handlePushToggle}
              disabled={isTogglingPush}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>
                Enable push notifications
                {isTogglingPush && <span className={styles.loadingSpinner}></span>}
              </div>
              <div className={styles.checkboxDescription}>
                Receive instant notifications in your browser for comments, mentions, and important updates.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Comments & Mentions Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Comments & Mentions</h4>
          <p>
            Notifications related to conversations across candidate profiles.
          </p>
        </div>

        <div className={styles.radioGroup}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="commentsAndMentions"
              checked={currentPreferences.commentsAndMentions === 'none'}
              onChange={() => updatePreference('commentsAndMentions', 'none')}
            />
            <div className={styles.radioContent}>
              <div className={styles.radioLabel}>Do not notify me</div>
              <div className={styles.radioDescription}>You won't receive any comment notifications.</div>
            </div>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="commentsAndMentions"
              checked={currentPreferences.commentsAndMentions === 'mentions'}
              onChange={() => updatePreference('commentsAndMentions', 'mentions')}
            />
            <div className={styles.radioContent}>
              <div className={styles.radioLabel}>Mentions only</div>
              <div className={styles.radioDescription}>Only sends notifications when someone mentions you.</div>
            </div>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="commentsAndMentions"
              checked={currentPreferences.commentsAndMentions === 'all'}
              onChange={() => updatePreference('commentsAndMentions', 'all')}
            />
            <div className={styles.radioContent}>
              <div className={styles.radioLabel}>All comments</div>
              <div className={styles.radioDescription}>Get notified for all comments and replies.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Updates & Changes Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Updates & Changes</h4>
          <p>
            Notifications when something you're involved in is updated, edited, or deleted.
          </p>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.careerUpdates}
              onChange={() => updatePreference('careerUpdates', !currentPreferences.careerUpdates)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Career updates</div>
              <div className={styles.checkboxDescription}>Notifies you when a career is edited or deleted.</div>
            </div>
          </label>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.projectUpdates}
              onChange={() => updatePreference('projectUpdates', !currentPreferences.projectUpdates)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Project updates</div>
              <div className={styles.checkboxDescription}>Notifies you when a project is edited or deleted.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Publication Status Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Publication Status</h4>
          <p>
            Notifications when your careers go live or becomes unpublished.
          </p>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.careerPublished}
              onChange={() => updatePreference('careerPublished', !currentPreferences.careerPublished)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Career published or unpublished</div>
              <div className={styles.checkboxDescription}>Alerts you when your career goes live or is unpublished.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Ownership Changes Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Ownership Changes</h4>
          <p>
            Notifications when ownership transfers.
          </p>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.careerOwnershipTransferred}
              onChange={() => updatePreference('careerOwnershipTransferred', !currentPreferences.careerOwnershipTransferred)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Career ownership transferred</div>
              <div className={styles.checkboxDescription}>Alerts you when a career changes ownership.</div>
            </div>
          </label>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.projectOwnershipTransferred}
              onChange={() => updatePreference('projectOwnershipTransferred', !currentPreferences.projectOwnershipTransferred)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Project ownership transferred</div>
              <div className={styles.checkboxDescription}>Alerts you when a project changes ownership.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Team Membership Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Team Membership</h4>
          <p>
            Notifications when people join or leave roles in items you're involved with.
          </p>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.careerTeamMembership}
              onChange={() => updatePreference('careerTeamMembership', !currentPreferences.careerTeamMembership)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Team member added/removed from a career</div>
              <div className={styles.checkboxDescription}>Notifies you when someone is added or removed from a career.</div>
            </div>
          </label>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.projectTeamMembership}
              onChange={() => updatePreference('projectTeamMembership', !currentPreferences.projectTeamMembership)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Team member added/removed from a project</div>
              <div className={styles.checkboxDescription}>Notifies you when someone is added or removed from a project.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Requisitions Section - Admin Only */}
      {isAdmin && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <h4>Requisitions [Admins only]</h4>
            <p>
              These are notifications when requisitions are created and updated.
            </p>
          </div>

          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="requisitions"
                checked={currentPreferences.requisitions === 'none'}
                onChange={() => updatePreference('requisitions', 'none')}
              />
              <div className={styles.radioContent}>
                <div className={styles.radioLabel}>Do not notify me</div>
                <div className={styles.radioDescription}>Do not receive any notifications.</div>
              </div>
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="requisitions"
                checked={currentPreferences.requisitions === 'new'}
                onChange={() => updatePreference('requisitions', 'new')}
              />
              <div className={styles.radioContent}>
                <div className={styles.radioLabel}>New requisitions only</div>
                <div className={styles.radioDescription}>Only notify me on newly created requisitions.</div>
              </div>
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="requisitions"
                checked={currentPreferences.requisitions === 'all'}
                onChange={() => updatePreference('requisitions', 'all')}
              />
              <div className={styles.radioContent}>
                <div className={styles.radioLabel}>All requisitions</div>
                <div className={styles.radioDescription}>Notify me for all requisition updates.</div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className={styles.modalOverlay} onClick={() => {
          setShowUnsavedModal(false);
          setPendingTabNavigation(null);
          setPendingSidebarUrl(null);
        }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => {
              setShowUnsavedModal(false);
              setPendingTabNavigation(null);
              setPendingSidebarUrl(null);
            }}>
              ×
            </button>
            <div className={styles.iconContainer}>
              <div className={styles.iconOuterCircle}>
                <div className={styles.iconInnerCircle}>
                  <AlertOctagon className={styles.modalIcon} />
                </div>
              </div>
            </div>
            <h3 className={styles.modalTitle}>You have unsaved changes</h3>
            <p className={styles.modalDescription}>
              Looks like you've made some changes. If you leave now, they won't be saved.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalDiscardButton}
                onClick={handleDiscardAndLeave}
              >
                Discard & Leave
              </button>
              <button
                className={styles.modalSaveButton}
                onClick={handleSaveAndLeave}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}