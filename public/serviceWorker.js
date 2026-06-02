// Service Worker for handling background uploads and push notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', async (event) => {
  let payload = {
    title: 'New Notification',
    body: 'You have a new notification',
    notificationId: '',
    entityLink: '/recruiter-dashboard/notifications',
    type: '',
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = {
        title: data.title || payload.title,
        body: data.body || payload.body,
        notificationId: data.notificationId || payload.notificationId,
        entityLink: data.entityLink || payload.entityLink,
        type: data.type || payload.type,
      };
    } catch (e) {
      throw new Error('Error parsing push payload:', e)
    }
  }

  // Show browser notification
  const showNotificationPromise = self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/jia-star.png',
    badge: '/jia-star.png',
    tag: payload.notificationId, // Prevent duplicates
    data: {
      notificationId: payload.notificationId,
      entityLink: payload.entityLink,
      type: payload.type,
    },
    requireInteraction: false,
  }).then(() => {
  });

  // Notify all open clients about the new notification
  const notifyClientsPromise = clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          payload: payload,
        });
      });
    });

  event.waitUntil(Promise.all([showNotificationPromise, notifyClientsPromise]));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const entityLink = data.entityLink || '/recruiter-dashboard/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(entityLink) && 'focus' in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(entityLink);
        }
      })
  );
});

self.addEventListener('message', async (event) => {
  if (event.data.type === 'UPLOAD_RECORDING') {
    const { recording, presignedUrl, interviewId } = event.data;
    const messagePort = event.ports[0];
    try {
      // Upload the recording
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: recording,
        headers: {
          'Content-Type': recording.type,
        }
      });

      if (uploadResponse.ok) {
        // Update interview status using fetch instead of axios
        const updateResponse = await fetch("/api/update-interview", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              interviewRecording: {
                filename: recording.name,
                filetype: recording.type,
              },
            },
            uid: interviewId,
          })
        });

        if (!updateResponse.ok) {
          throw new Error('Failed to update interview status');
        }

        messagePort.postMessage({
          type: 'UPLOAD_COMPLETE',
          interviewId,
          success: true
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      // Notify the client of failed upload
      messagePort.postMessage({
        type: 'UPLOAD_ERROR',
        interviewId,
        error: error.message
      });
    }
  }
});