
import pool from '../../shared/utils/db.js';

export async function getNotifications(userId) {
  const result = await pool.query(
    `SELECT
       id,
       type AS title,
       contenu AS message,
       is_read,
       date_envoi AS created_at
     FROM notifications
     WHERE utilisateur_id = $1
     ORDER BY is_read ASC, date_envoi DESC
     LIMIT 50`,
    [userId]
  );

  return result.rows;
}

export async function getUnreadCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE utilisateur_id = $1
       AND is_read = FALSE`,
    [userId]
  );

  return parseInt(result.rows[0].count, 10);
}

export async function markAsRead(userId, notificationId) {
  await pool.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = $1 AND utilisateur_id = $2`,
    [notificationId, userId]
  );

  return { success: true };
}

export async function markAllAsRead(userId) {
  await pool.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE utilisateur_id = $1`,
    [userId]
  );

  return { success: true };
}
