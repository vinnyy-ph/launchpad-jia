"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/context/NotificationContext';
import { api } from '@/lib/utils/apiClient';
import { errorToast, successToast } from '@/lib/Utils';
import { GuestNotificationPreferences } from '@/lib/utils/notificationHelpers';
import styles from '@/lib/styles/guestPortal/settings.module.scss';
import Image from 'next/image';
const DEFAULT_PREFERENCES: GuestNotificationPreferences = {
  requisitionApproved: true,
  requisitionHold: true,
  careerPublished: true,
  careerTeamMembership: true,
  commentsAndMentions: 'mentions',
};

export default function GuestNotificationSettings() {
  const router = useRouter();
  const { isPushEnabled, subscribeToPush, unsubscribeFromPush } = useNotifications();
  const [savedPreferences, setSavedPreferences] = useState<GuestNotificationPreferences | null>(null);
  const [currentPreferences, setCurrentPreferences] = useState<GuestNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    if (!savedPreferences || !currentPreferences) return false;
    return JSON.stringify(savedPreferences) !== JSON.stringify(currentPreferences);
  }, [savedPreferences, currentPreferences]);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/notifications/preferences');
      const prefs = response.data.preferences || DEFAULT_PREFERENCES;
      setSavedPreferences(prefs);
      setCurrentPreferences(prefs);
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (key: keyof GuestNotificationPreferences, value: any) => {
    if (!currentPreferences) return;
    setCurrentPreferences({
      ...currentPreferences,
      [key]: value,
    });
  };

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

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/api/notifications/preferences', { preferences: currentPreferences });
      setSavedPreferences(currentPreferences);
      successToast('Notification settings saved', 1200);
      router.back();
    } catch (error) {
      errorToast(error.message || 'Failed to save notification preferences', 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setCurrentPreferences(savedPreferences);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingPanel}>
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
          <p>Manage how you receive notifications about your requisitions and careers.</p>
        </header>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button
            className={styles.revertButton}
            onClick={handleRevert}
            disabled={!hasUnsavedChanges || saving}
          >
            Revert
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
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
                Receive instant notifications in your browser for updates on your requisitions and careers.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Requisitions Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Requisitions</h4>
          <p>
            Notifications about the status of your requisitions.
          </p>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.requisitionApproved}
              onChange={() => updatePreference('requisitionApproved', !currentPreferences.requisitionApproved)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Requisition approved</div>
              <div className={styles.checkboxDescription}>Notifies you when your requisition is approved.</div>
            </div>
          </label>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.requisitionHold}
              onChange={() => updatePreference('requisitionHold', !currentPreferences.requisitionHold)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Requisition put on hold</div>
              <div className={styles.checkboxDescription}>Notifies you when your requisition is put on hold.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Careers Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Careers</h4>
          <p>
            Notifications about careers you're involved with.
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
              <div className={styles.checkboxLabel}>Career published</div>
              <div className={styles.checkboxDescription}>Notifies you when a career is published from your requisition.</div>
            </div>
          </label>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.careerTeamMembership}
              onChange={() => updatePreference('careerTeamMembership', !currentPreferences.careerTeamMembership)}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Added to career team</div>
              <div className={styles.checkboxDescription}>Notifies you when you are added to a career team.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Comments & Mentions Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h4>Comments & Mentions</h4>
          <p>
            Notifications related to conversations on careers you can access.
          </p>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={currentPreferences.commentsAndMentions === 'mentions' || currentPreferences.commentsAndMentions === 'all'}
              onChange={() => {
                if (currentPreferences.commentsAndMentions === 'none') {
                  updatePreference('commentsAndMentions', 'mentions');
                } else {
                  updatePreference('commentsAndMentions', 'none');
                }
              }}
            />
            <div className={styles.checkboxContent}>
              <div className={styles.checkboxLabel}>Mentions</div>
              <div className={styles.checkboxDescription}>Notifies you when someone mentions you in a comment.</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
