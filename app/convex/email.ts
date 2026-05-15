import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const USER_EMAILS: Record<string, string> = {
  "hong-zhe":  "hongzhetan7@gmail.com",
  "wei-zen":   "ooiweizen@gmail.com",
  "chun-wen":  "ooichunwen04@gmail.com",
  "yong-zhi":  "tongyz06@gmail.com",
  "dzuldiniy": "dzuldiniy.h@gmail.com",
  "fangnan":   "7l3e0rizonix@gmail.com",
  "yida":      "wyida7372@gmail.com",
};

async function callResend(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Y2 PMS <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err.slice(0, 200)}`);
  }
}

function buildHtml(heading: string, body: string): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3001";
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#111;color:#e5e5e5;padding:32px;max-width:520px;margin:0 auto;">
  <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:24px;">
    <div style="font-family:monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#666;margin-bottom:8px;">Y2-PMS-001 · Solar Bus Demonstrator</div>
    <h2 style="margin:0 0 16px;font-size:18px;color:#fff;">${heading}</h2>
    <div style="color:#ccc;line-height:1.6;">${body}</div>
    <div style="margin-top:20px;">
      <a href="${appUrl}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:600;font-size:13px;padding:8px 16px;border-radius:6px;text-decoration:none;">Open Dashboard</a>
    </div>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #333;font-size:11px;color:#555;">Automated notification from Y2 Project Management System.</div>
  </div>
</body>
</html>`;
}

export const sendAssignedEmail = internalAction({
  args: { todoId: v.id("todos"), userId: v.string() },
  handler: async (ctx, { todoId, userId }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;
    const toEmail = USER_EMAILS[userId];
    if (!toEmail) return;

    const already = await ctx.runQuery(internal.email.hasSentEmail, { todoId, userId, type: "assigned" });
    if (already) return;

    const todo = await ctx.runQuery(internal.todos.getById, { id: todoId });
    if (!todo) return;

    const dueLine = todo.dueDate
      ? `<p>Due: <strong>${new Date(todo.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</strong></p>`
      : "";

    try {
      await callResend(
        apiKey,
        toEmail,
        `Task assigned: ${todo.text}`,
        buildHtml("New task assigned to you", `<p><strong>${todo.text}</strong></p>${dueLine}`),
      );
      await ctx.runMutation(internal.email.recordSentEmail, { todoId, userId, type: "assigned" });
    } catch (e) {
      console.error("[email] sendAssignedEmail failed", e);
    }
  },
});

export const dailyEmailCheck = internalAction({
  handler: async (ctx) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const now = Date.now();
    const in25h = now + 25 * 60 * 60 * 1000;

    const [dueSoon, overdue] = await Promise.all([
      ctx.runQuery(internal.todos.getDueSoon, { from: now, to: in25h }),
      ctx.runQuery(internal.todos.getOverdue, { before: now }),
    ]);

    for (const todo of dueSoon) {
      for (const userId of todo.assignedTo) {
        const toEmail = USER_EMAILS[userId];
        if (!toEmail) continue;
        const already = await ctx.runQuery(internal.email.hasSentEmail, {
          todoId: todo._id, userId, type: "due_soon",
        });
        if (already) continue;
        try {
          const due = new Date(todo.dueDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          await callResend(
            apiKey,
            toEmail,
            `Reminder: "${todo.text}" is due tomorrow`,
            buildHtml("Task due tomorrow", `<p><strong>${todo.text}</strong></p><p>Due: <strong>${due}</strong></p>`),
          );
          await ctx.runMutation(internal.email.recordSentEmail, { todoId: todo._id, userId, type: "due_soon" });
        } catch (e) {
          console.error("[email] due_soon failed", e);
        }
      }
    }

    for (const todo of overdue) {
      for (const userId of todo.assignedTo) {
        const toEmail = USER_EMAILS[userId];
        if (!toEmail) continue;
        const sentToday = await ctx.runQuery(internal.email.hasSentEmailToday, {
          todoId: todo._id, userId, type: "overdue",
        });
        if (sentToday) continue;
        try {
          const daysLate = Math.max(1, Math.floor((now - todo.dueDate!) / 86_400_000));
          const due = new Date(todo.dueDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          await callResend(
            apiKey,
            toEmail,
            `Overdue: "${todo.text}" (${daysLate}d late)`,
            buildHtml(
              "Task overdue",
              `<p><strong>${todo.text}</strong></p><p>Was due: <strong>${due}</strong> — ${daysLate} day${daysLate !== 1 ? "s" : ""} ago</p>`,
            ),
          );
          await ctx.runMutation(internal.email.recordSentEmail, { todoId: todo._id, userId, type: "overdue" });
        } catch (e) {
          console.error("[email] overdue failed", e);
        }
      }
    }
  },
});

export const hasSentEmail = internalQuery({
  args: { todoId: v.id("todos"), userId: v.string(), type: v.string() },
  handler: async (ctx, { todoId, userId, type }) => {
    const rec = await ctx.db
      .query("sentEmails")
      .withIndex("by_todo_user_type", (q) =>
        q.eq("todoId", todoId).eq("userId", userId).eq("type", type as "assigned" | "due_soon" | "overdue"),
      )
      .first();
    return rec !== null;
  },
});

export const hasSentEmailToday = internalQuery({
  args: { todoId: v.id("todos"), userId: v.string(), type: v.string() },
  handler: async (ctx, { todoId, userId, type }) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rec = await ctx.db
      .query("sentEmails")
      .withIndex("by_todo_user_type", (q) =>
        q.eq("todoId", todoId).eq("userId", userId).eq("type", type as "assigned" | "due_soon" | "overdue"),
      )
      .order("desc")
      .first();
    return rec !== null && rec.sentAt >= startOfDay.getTime();
  },
});

export const recordSentEmail = internalMutation({
  args: {
    todoId: v.id("todos"),
    userId: v.string(),
    type: v.union(v.literal("assigned"), v.literal("due_soon"), v.literal("overdue")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sentEmails", { ...args, sentAt: Date.now() });
  },
});
