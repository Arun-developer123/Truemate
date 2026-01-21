/* ===================================================================
   FILE: src/app/api/contact/route.ts
   =================================================================== */

// Next.js API Route (App Router) — serverless friendly

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, message } = body as {
      name: string;
      email: string;
      message: string;
    };

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Use environment variables for SMTP configuration
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const contactTo = process.env.CONTACT_TO_EMAIL || "hello@truemateai.com";

    if (!smtpHost || !smtpUser || !smtpPass) {
      // If SMTP is not configured, accept the message but return a 202 and log it server-side
      console.warn("SMTP not configured — contact saved as log. Message:", body);
      return NextResponse.json(
        { ok: true, notice: "SMTP not configured; message accepted as log" },
        { status: 202 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      secure: smtpPort === 465,
    });

    const mailHtml = `
      <div>
        <h2>New Contact Message from Truemate</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      </div>
    `;

    await transporter.sendMail({
      from: `${escapeHtml(name)} <${escapeHtml(email)}>`,
      to: contactTo,
      subject: `Truemate Contact: ${escapeHtml(name)}`,
      html: mailHtml,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("Unknown error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
