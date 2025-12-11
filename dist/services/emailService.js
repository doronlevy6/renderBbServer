"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPaymentConfirmationEmail = sendPaymentConfirmationEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Create reusable transporter
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
function sendPaymentConfirmationEmail(recipientEmail, username, amount, method, date) {
    return __awaiter(this, void 0, void 0, function* () {
        // Skip if email not configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log('Email not configured. Skipping payment confirmation email.');
            return;
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
            yield transporter.sendMail(mailOptions);
            console.log(`Payment confirmation email sent to ${recipientEmail}`);
        }
        catch (error) {
            console.error('Error sending email:', error);
            // Don't throw - we don't want email failures to block payment recording
        }
    });
}
