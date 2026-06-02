'use client';

import { useEffect, useRef, useCallback, Fragment, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotifications } from '@/lib/context/NotificationContext';
import { useAccumulatedNotifications, markAllNotificationsAsRead } from '@/lib/hooks/useNotificationData';
import { NotificationDocument } from '@/lib/utils/notificationTypes';
import NotificationItem from './NotificationItem';
import MeatballsMenu, { MeatballsMenuItem } from '@/lib/components/NotificationComponents/MeatballsMenu';
import { Bell01 } from '@untitledui/icons';
import styles from './NotificationModal.module.scss';
import Image from 'next/image';

const NOTIFICATIONS_PER_PAGE = 20;

export default function NotificationModal() {
  const { isModalOpen, closeModal } = useNotifications();
  const searchParams = useSearchParams();
  const orgID = searchParams.get('orgID') || searchParams.get('orgId');
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isGuest, setIsGuest] = useState(false);

  // Check guest status on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('role');
      const activeOrgStr = localStorage.getItem('activeOrg');
      let activeOrgRole = null;
      try {
        if (activeOrgStr) {
          activeOrgRole = JSON.parse(activeOrgStr)?.role;
        }
      } catch (e) {
        // Ignore parse errors
      }
      setIsGuest(role === 'guest' || activeOrgRole === 'guest');
    }
  }, []);

  // Accumulated notifications hook
  const {
    notifications: allNotifications,
    hasMore,
    isLoading,
    loadMore,
    reset,
    refresh
  } = useAccumulatedNotifications(NOTIFICATIONS_PER_PAGE);

  useEffect(() => {
    if (isModalOpen) {
      reset();
      refresh();
    }
  }, [isModalOpen, reset, refresh]);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      // If the click is on the trigger button (or its children), ignore it
      // The trigger button will handle the toggle via its onClick handler
      if (target.closest('[data-notification-trigger="true"]')) {
        return;
      }

      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        closeModal();
      }
    }

    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isModalOpen, closeModal]);

  // Infinite scroll
  useEffect(() => {
    if (!isModalOpen || !listRef.current) return;

    const handleScroll = () => {
      if (!listRef.current || isLoading || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;

      if (scrolledToBottom) {
        loadMore();
      }
    };

    const listElement = listRef.current;
    listElement.addEventListener('scroll', handleScroll);
    return () => listElement.removeEventListener('scroll', handleScroll);
  }, [isModalOpen, isLoading, hasMore, loadMore]);

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllNotificationsAsRead(orgID || undefined);
  }, [orgID]);

  const handleViewFullPage = useCallback(() => {
    router.push(`/recruiter-dashboard/notifications?orgID=${orgID}`);
    closeModal();
  }, [router, closeModal, orgID]);

  const handleGoToSettings = useCallback(() => {
    if (isGuest) {
      router.push(`/guest-portal/settings?orgId=${orgID}`);
    } else {
      router.push(`/recruiter-dashboard/settings?tab=notifications&orgID=${orgID}`);
    }
    closeModal();
  }, [router, closeModal, orgID, isGuest]);

  // Build menu items based on user role
  const meatballsMenuItems: MeatballsMenuItem[] = [
    {
      icon: 'las la-check',
      label: 'Mark all as read',
      onClick: handleMarkAllAsRead,
    },
    {
      icon: 'las la-cog',
      label: 'Notification settings',
      onClick: handleGoToSettings,
    },
    // Only show "View in full page" for non-guest users
    ...(!isGuest ? [{
      icon: 'las la-external-link-alt',
      label: 'View in full page',
      onClick: handleViewFullPage,
    }] : []),
  ];

  // Group notifications by date
  const groupNotificationsByDate = (notifications: NotificationDocument[]) => {
    const today: NotificationDocument[] = [];
    const earlier: NotificationDocument[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    notifications.forEach((notification) => {
      const notifDate = new Date(notification.createdAt);
      if (notifDate >= todayStart) {
        today.push(notification);
      } else {
        earlier.push(notification);
      }
    });

    return { today, earlier };
  };

  const { today: todayNotifications, earlier: earlierNotifications } =
    groupNotificationsByDate(allNotifications);

  if (!isModalOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.header}>
          <h3>Notifications</h3>
          <div className={styles.headerActions}>
            <MeatballsMenu items={meatballsMenuItems} />
            <button
              className={styles.closeButton}
              onClick={closeModal}
              aria-label="Close notifications"
            >
              <i className="las la-times"></i>
            </button>
          </div>
        </div>

        <div className={styles.notificationList} ref={listRef}>
          {allNotifications.length === 0 && !isLoading ? (
            <div className={styles.emptyState}>
              <Bell01 width={24} height={24} />
              <p>No notifications yet</p>
            </div>
          ) : (
            <>
              {/* Today Notifications */}
              {todayNotifications.length > 0 && (
                <div className={styles.todayNotifications}>
                  <div className={styles.dateHeader}>Today</div>
                  {todayNotifications.map((notification, index) => (
                    <Fragment key={notification._id}>
                      <NotificationItem
                        notification={notification}
                        onClose={closeModal}
                        />
                      {index !== todayNotifications.length - 1 && <hr />}
                    </Fragment>
                  ))}
                </div>
              )}

              {/* Earlier Notifications */}
              {earlierNotifications.length > 0 && (
                <div className={styles.earlierNotifications}>
                  <div className={styles.dateHeader}>Earlier</div>
                  {earlierNotifications.map((notification, index) => (
                    <Fragment key={notification._id}>
                      <NotificationItem
                      notification={notification}
                      onClose={closeModal}
                      />
                      {index !== earlierNotifications.length - 1 && <hr />}
                    </Fragment>
                  ))}
                </div>
              )}

              {isLoading && (
                <div className={styles.loading}>
                  <Image
                    src="/gifs/analysis-loading.gif"
                    alt="Loading"
                    width={40}
                    height={40}
                    className={styles.loadingIcon}
                  />
                  <span>Loading...</span>
                </div>
              )}

              {!isLoading && hasMore && (
                <button
                  className={styles.seePreviousButton}
                  onClick={loadMore}
                >
                  See previous notifications
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
