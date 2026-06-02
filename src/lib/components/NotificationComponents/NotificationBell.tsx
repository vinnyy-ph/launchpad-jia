'use client';

import { useNotifications } from '@/lib/context/NotificationContext';
import { useUnreadCount } from '@/lib/hooks/useNotificationData';
import { Bell01 } from '@untitledui/icons';
import styles from './NotificationBell.module.scss';

export default function NotificationBell() {
  const { openModal, closeModal, isModalOpen } = useNotifications();
  const { unreadCount, isLoading } = useUnreadCount();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isModalOpen) {
      closeModal();
    } else {
      openModal();
    }
  };

  return (
    <button
      className={styles.notificationBell}
      onClick={handleToggle}
      aria-label="Notifications"
      title="Notifications"
      disabled={isLoading}
      data-notification-trigger="true"
    >
      {/* Bell Icon */}
      <Bell01 className={styles.bellIcon} />

      {/* Badge counter - only show if unread count > 0 */}
      {unreadCount > 0 && (
        <span className={styles.badge}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

