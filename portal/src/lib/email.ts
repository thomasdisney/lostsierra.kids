import { Resend } from "resend";
import crypto from "crypto";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    await getResend().emails.send({
      from: "Lost Sierra Kids <onboarding@resend.dev>",
      to: email,
      subject: "Verify your email — Lost Sierra Kids Portal",
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
          <h2 style="color: #1e3a2f; margin-bottom: 0.5rem;">Verify your email</h2>
          <p style="color: #4a7c67; font-size: 0.95rem;">
            Enter this code in the portal to verify your account:
          </p>
          <div style="background: #f5f1eb; border-radius: 12px; padding: 1.5rem; text-align: center; margin: 1.5rem 0;">
            <span style="font-size: 2rem; font-weight: 700; letter-spacing: 0.3em; color: #1e3a2f;">
              ${code}
            </span>
          </div>
          <p style="color: #888; font-size: 0.8rem;">
            This code expires in 15 minutes. If you didn't create an account, ignore this email.
          </p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return false;
  }
}
