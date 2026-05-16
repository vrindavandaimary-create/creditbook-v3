/**
 * notificationController.js
 *
 * In-app notification bell management.
 * Notifications are created automatically by reminderController.
 */

const Notification = require('../models/Notification');

/* GET /api/notifications?unread=true&limit=50 */
const getNotifications = async (req, res) => {
  try {
    const { unread, limit = 50, page = 1 } = req.query;
    const q = { userId: req.user._id };
    if (unread === 'true') q.isRead = false;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total, unreadCount] = await Promise.all([
      Notification.find(q)
        .populate('partyId', 'name')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(skip)
        .lean(),
      Notification.countDocuments(q),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

    res.json({ success: true, count: data.length, total, unreadCount, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* POST /api/notifications/:id/read */
const markRead = async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!n) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true, data: n });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* POST /api/notifications/read-all */
const markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, updated: result.modifiedCount });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* DELETE /api/notifications/:id */
const deleteNotification = async (req, res) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!n) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true, message: 'Deleted.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* DELETE /api/notifications — clear all read notifications */
const clearRead = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user._id, isRead: true });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getNotifications, markRead, markAllRead, deleteNotification, clearRead };
