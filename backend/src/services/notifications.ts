import nodemailer from 'nodemailer';
import prisma from '../config/prisma';

// Setup Nodemailer transporter dynamically based on environment variables
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }
  return null;
}

export async function sendEmailNotification(orderId: string, customerId: string, email: string, status: string, notes?: string) {
  const subject = `Order Status Update: #${orderId.substring(0, 8).toUpperCase()} is ${status}`;
  const body = `Dear Customer,

Your order status has updated to: ${status}.
${notes ? `Details: ${notes}` : ''}

You can track your live order details in the Last-Mile Delivery Tracker dashboard.

Thank you,
The Last-Mile Delivery Team`;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Last-Mile Logistics" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        text: body
      });
      console.log(`[SMTP EMAIL SENT TO CUSTOMER: ${email}] Status: ${status}`);
    } catch (mailErr: any) {
      console.error(`Failed to send real email to ${email}:`, mailErr.message);
    }
  } else {
    console.log(`\n======================================================`);
    console.log(`[SMTP NOT CONFIGURED - MOCK EMAIL SENT TO CUSTOMER: ${email}]`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.log(`======================================================\n`);
  }

  // Write log to DB
  try {
    await prisma.notificationLog.create({
      data: {
        orderId,
        channel: 'EMAIL',
        recipient: email,
        status: 'SENT'
      }
    });
  } catch (err) {
    console.error('Failed to log notification to database:', err);
  }
}

export async function sendAgentAssignmentEmail(orderId: string, agentEmail: string, pickupPincode: string, dropPincode: string, notes?: string) {
  const subject = `New Delivery Shipment Assigned: #${orderId.substring(0, 8).toUpperCase()}`;
  const body = `Dear Agent,

A new delivery order has been assigned to you.

Order Reference: #${orderId.toUpperCase()}
Pickup Zone Pincode: ${pickupPincode}
Drop Zone Pincode: ${dropPincode}
${notes ? `Notes: ${notes}` : ''}

Please log in to your Agent Dashboard to mark shift changes or progress the delivery timeline.

Thank you,
The Last-Mile Operations Team`;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Last-Mile Logistics" <${process.env.SMTP_USER}>`,
        to: agentEmail,
        subject,
        text: body
      });
      console.log(`[SMTP EMAIL SENT TO AGENT: ${agentEmail}] New assignment: #${orderId}`);
    } catch (mailErr: any) {
      console.error(`Failed to send real email to agent ${agentEmail}:`, mailErr.message);
    }
  } else {
    console.log(`\n======================================================`);
    console.log(`[SMTP NOT CONFIGURED - MOCK EMAIL SENT TO AGENT: ${agentEmail}]`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.log(`======================================================\n`);
  }

  // Write log to DB
  try {
    await prisma.notificationLog.create({
      data: {
        orderId,
        channel: 'EMAIL',
        recipient: agentEmail,
        status: 'SENT'
      }
    });
  } catch (err) {
    console.error('Failed to log agent notification to database:', err);
  }
}
