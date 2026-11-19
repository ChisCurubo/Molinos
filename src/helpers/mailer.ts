import nodemailer from 'nodemailer';
import { CONFIG } from '../config/config';

/** Envía por SMTP; si no hay SMTP configurado, imprime el correo en consola (solo desarrollo). */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
    if (!CONFIG.smtpHost) {
        console.log(`[mailer] SMTP no configurado. Para ${to}: ${subject}\n${text}`);
        return;
    }
    const transport = nodemailer.createTransport({
        host: CONFIG.smtpHost,
        port: CONFIG.smtpPort,
        secure: CONFIG.smtpPort === 465,
        auth: { user: CONFIG.smtpUser, pass: CONFIG.smtpPass },
    });
    await transport.sendMail({ from: CONFIG.smtpFrom, to, subject, text });
}
