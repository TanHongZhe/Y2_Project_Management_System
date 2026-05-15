import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "daily-email-reminders",
  { hourUTC: 8, minuteUTC: 0 },
  internal.email.dailyEmailCheck,
);

export default crons;
