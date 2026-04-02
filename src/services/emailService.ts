import nodemailer from 'nodemailer';

export interface PaymentEmailResult {
    attempted: boolean;
    sent: boolean;
    reason?: 'smtp_not_configured' | 'missing_recipient_email' | 'send_failed';
}

// Create reusable transporter
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for STARTTLS ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendPaymentConfirmationEmail(
    recipientEmail: string,
    username: string,
    amount: number,
    method: string,
    date: Date
): Promise<PaymentEmailResult> {
    if (!recipientEmail || recipientEmail.trim() == '') {
        return {
            attempted: false,
            sent: false,
            reason: 'missing_recipient_email',
        };
    }

    // Skip if email not configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('Email not configured. Skipping payment confirmation email.');
        return {
            attempted: false,
            sent: false,
            reason: 'smtp_not_configured',
        };
    }

    const formattedDate = new Date(date).toLocaleDateString('he-IL');
    const mailOptions = {
        from: `"Baller Team" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: 'אישור תשלום - Payment Confirmation',
        html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">✅ קיבלנו את התשלום שלך!</h2>
          <p>שלום <strong>${username}</strong>,</p>
          <p>רק רצינו לעדכן אותך שקיבלנו את התשלום שלך:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>סכום:</strong> ${amount} ₪</p>
            <p style="margin: 5px 0;"><strong>אמצעי תשלום:</strong> ${method}</p>
            <p style="margin: 5px 0;"><strong>תאריך:</strong> ${formattedDate}</p>
          </div>
          <p>תודה רבה! 🏀</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #888;">
            זהו מייל אוטומטי, אין צורך להשיב.
          </p>
        </div>
      </div>
    `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Payment confirmation email sent to ${recipientEmail}`);
        return {
            attempted: true,
            sent: true,
        };
    } catch (error) {
        console.error('Error sending email:', error);
        // Don't throw - we don't want email failures to block payment recording
        return {
            attempted: true,
            sent: false,
            reason: 'send_failed',
        };
    }
}
