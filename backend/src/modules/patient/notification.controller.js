import * as service from './notification.service.js';

export async function listNotifications(req, res) {
  try {
    const notifications = await service.getNotifications(req.user.id);
    const unread = await service.getUnreadCount(req.user.id);
    res.json({ success: true, data: notifications, unread });
  } catch (err) {
    console.error('[notification] list:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

export async function readNotification(req, res) {
  try {
    const result = await service.markAsRead(req.user.id, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

export async function readAll(req, res) {
  try {
    const result = await service.markAllAsRead(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}