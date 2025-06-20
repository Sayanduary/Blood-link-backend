import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { socketStore } from './socketStore.js';

dotenv.config();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send email notification
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
export const sendEmail = async (to, subject, text, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"BloodLink" <noreply@bloodlink.com>',
      to,
      subject,
      text,
      html: html || text
    };
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

/**
 * Send realtime notification via socket.io
 * @param {string} userId
 * @param {string} type
 * @param {object} data
 * @param {object} io - socket.io instance
 */
export const sendSocketNotification = (userId, type, data, io) => {
  try {
    if (!userId || !io) return false;
    const socketId = socketStore.getUserSocket(userId);
    if (socketId) {
      io.to(socketId).emit('notification', { type, ...data });
    } else {
      io.to(`user:${userId}`).emit('notification', { type, ...data });
    }
    return true;
  } catch (error) {
    console.error('Socket notification error:', error);
    return false;
  }
};

/**
 * Create notification in database
 * @param {Model} Notification
 * @param {object} notificationData
 */
export const createNotification = async (Notification, notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Notification creation error:', error);
    throw error;
  }
};

/**
 * Send notification via email, socket, and database
 * @param {object} user - User object
 * @param {object} data - {title, message, type, actionUrl, details}
 * @param {Model} Notification
 * @param {object} io - socket.io instance
 */
export const notifyUser = async (user, data, Notification, io) => {
  const { _id: userId, email, preferences = {}, name } = user;
  const { title, message, type, actionUrl, details } = data;
  const results = { email: null, socket: null, database: null };
  try {
    // Save in DB
    const notification = await createNotification(Notification, {
      user: userId,
      title,
      message,
      type,
      actionUrl,
      details,
      isRead: false,
      createdAt: new Date()
    });
    results.database = notification;

    // Socket notification
    if (preferences.notifyByPush !== false && io) {
      results.socket = sendSocketNotification(userId, type, {
        ...data,
        notificationId: notification._id
      }, io);
    }

    // Email notification
    if (preferences.notifyByEmail !== false && email) {
      const emailText = `Hello ${name},\n\n${message}\n\n${actionUrl ? `Link: ${actionUrl}` : ''}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #d9534f;">${title}</h2>
          <p>${message}</p>
          ${actionUrl ? `<p><a href="${actionUrl}" style="background:#d9534f;color:white;padding:10px 15px;text-decoration:none;border-radius:4px;">View Details</a></p>` : ''}
          <hr>
          <p style="font-size:12px;color:#777;">BloodLink - Connecting donors and patients in need</p>
        </div>
      `;
      results.email = await sendEmail(email, `BloodLink: ${title}`, emailText, emailHtml);
    }

    return results;
  } catch (error) {
    console.error('User notification error:', error);
    throw error;
  }
};