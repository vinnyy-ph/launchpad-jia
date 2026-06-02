'use client';

import { useState, Fragment, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccumulatedNotifications, markAllNotificationsAsRead } from '@/lib/hooks/useNotificationData';
import { NotificationDocument } from '@/lib/utils/notificationTypes';
import NotificationItem from '@/lib/components/NotificationComponents/NotificationItem';
import MeatballsMenu, { MeatballsMenuItem } from '@/lib/components/NotificationComponents/MeatballsMenu';
import HeaderBar from '@/lib/PageComponent/HeaderBar';
import useDebounce from '@/lib/hooks/useDebounceHook';
import styles from './notifications.module.scss';
import { Bell01 } from '@untitledui/icons';

const NOTIFICATIONS_PER_PAGE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgID = searchParams.get('orgID');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showAllEarlier, setShowAllEarlier] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { notifications: allNotifications, isLoading, hasMore, loadMore } =
    useAccumulatedNotifications(NOTIFICATIONS_PER_PAGE, debouncedSearchQuery);

  const handleLoadMore = () => {
    loadMore();
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead(orgID || undefined);
  };

  const handleGoToSettings = () => {
    router.push(`/recruiter-dashboard/settings?tab=notifications&orgID=${orgID}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearching(true);
    setShowAllEarlier(false); // Reset expansion on new search
  };

  // Clear isSearching when search results load
  useEffect(() => {
    if (!isLoading) {
      setIsSearching(false);
    }
  }, [debouncedSearchQuery, isLoading]);

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

  // Today: limit to 5, overflow goes to Earlier
  const displayedTodayNotifications = todayNotifications.slice(0, 5);
  const todayOverflow = todayNotifications.slice(5);

  // Earlier: combine overflow from today + earlier notifications
  const combinedEarlier = [...todayOverflow, ...earlierNotifications];
  const displayedEarlierNotifications = showAllEarlier
    ? combinedEarlier
    : combinedEarlier.slice(0, 5);

  const hasMoreEarlier = combinedEarlier.length > 5;

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
  ];

  const NotificationSkeleton = () => (
    <div className={styles.skeletonItem}>
      <div className={styles.skeletonAvatar}></div>
      <div className={styles.skeletonContent}>
        <div className={styles.skeletonTitle}></div>
        <div className={styles.skeletonText}></div>
      </div>
    </div>
  );

  return (
    <>
      <HeaderBar
        activeLink="Notifications"
        iconJsx={<Bell01 className={styles.bellIcon} />}
      />
      <div className={styles.notificationsPage}>
        {/* Notifications Title */}
        <div className={styles.notificationsTitle}>
          <div className={styles.header}>
            <h2>Notifications</h2>
            <MeatballsMenu items={meatballsMenuItems} />
          </div>
          {/* Search Bar */}
          <div className={styles.searchContainer}>
            <i className={`las la-search la-lg ${styles.searchIcon}`}></i>
            <input
              type="text"
              name="search-notifications"
              placeholder="Search for keywords"
              value={searchQuery}
              onChange={handleSearchChange}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                className={styles.clearButton}
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className={styles.notificationsList}>
          {isSearching || (isLoading && debouncedSearchQuery) ? (
            // Skeleton during search
            <div className={styles.skeletonContainer}>
              <div className={styles.dateHeader}>Today</div>
              {[...Array(3)].map((_, i) => (
                <Fragment key={i}>
                  <NotificationSkeleton />
                  {i < 2 && <hr />}
                </Fragment>
              ))}
              <div className={styles.dateHeader} style={{ marginTop: '24px' }}>Earlier</div>
              {[...Array(2)].map((_, i) => (
                <Fragment key={`earlier-${i}`}>
                  <NotificationSkeleton />
                  {i < 1 && <hr />}
                </Fragment>
              ))}
            </div>
          ) : allNotifications.length === 0 ? (
            // Empty state
            <div className={styles.emptyState}>
              <Bell01 className={styles.bellIcon} />
              <p>
                {searchQuery
                  ? 'No notifications match your search'
                  : 'No notifications yet'}
              </p>
            </div>
          ) : (
            // Actual notifications
            <>
              {/* Today Notifications */}
              {displayedTodayNotifications.length > 0 && (
                <div className={styles.todayNotifications}>
                  <div className={styles.dateHeader}>Today</div>
                  {displayedTodayNotifications.map((notification, index) => (
                    <Fragment key={notification._id}>
                      <NotificationItem
                        key={notification._id}
                        notification={notification}
                        onClose={() => {}}
                      />
                      {index !== displayedTodayNotifications.length - 1 && <hr />}
                    </Fragment>
                  ))}
                </div>
              )}

              {/* Earlier Notifications */}
              {combinedEarlier.length > 0 && (
                <div className={styles.earlierNotifications}>
                  <div className={styles.dateHeader}>Earlier</div>
                  {displayedEarlierNotifications.map((notification, index) => (
                    <Fragment key={notification._id}>
                      <NotificationItem
                        key={notification._id}
                        notification={notification}
                        onClose={() => {}}
                      />
                      {index !== displayedEarlierNotifications.length - 1 && <hr />}
                    </Fragment>
                  ))}
                  {hasMoreEarlier && !showAllEarlier && (
                    <button
                      className={styles.seePreviousButton}
                      onClick={() => setShowAllEarlier(true)}
                    >
                      See previous notifications
                    </button>
                  )}
                </div>
              )}

              {isLoading && (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <span>Loading...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
