import { query } from "./_generated/server";

const BUDGET_CAP = 60.0;

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const components = await ctx.db.query("components").take(500);
    const tests = await ctx.db
      .query("tests")
      .withIndex("by_testedAt")
      .order("desc")
      .take(50);
    const memoryNotes = await ctx.db.query("memoryNotes").take(50);
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_uploadedAt")
      .order("desc")
      .take(100);
    const progressImages = await ctx.db.query("progressImages").take(500);

    const statusBreakdown = ["installed", "received", "ordered", "planned"].map(
      (s) => ({
        status: s,
        count: components.filter((c) => c.status === s).length,
      }),
    );

    const spent = components
      .filter((c) => c.status !== "planned")
      .reduce((s, c) => s + c.estCost * c.qty, 0);

    const committed = components.reduce((s, c) => s + c.estCost * c.qty, 0);

    const subsystems = new Map<
      string,
      { id: string; count: number; lastResult: string; lastTitle: string; lastAt: number }
    >();
    for (const t of tests) {
      const cur = subsystems.get(t.subsystem) ?? {
        id: t.subsystem,
        count: 0,
        lastResult: "pending",
        lastTitle: "",
        lastAt: 0,
      };
      cur.count += 1;
      if (t.testedAt > cur.lastAt) {
        cur.lastAt = t.testedAt;
        cur.lastResult = t.result;
        cur.lastTitle = t.title;
      }
      subsystems.set(t.subsystem, cur);
    }

    const recentActivity: Array<{
      ts: number;
      who: "ai" | "you";
      what: string;
    }> = [];
    for (const t of tests.slice(0, 5)) {
      recentActivity.push({
        ts: t.testedAt,
        who: t.author === "ai" ? "ai" : "you",
        what: `Recorded test ${t.testId} — ${t.title}`,
      });
    }
    recentActivity.sort((a, b) => b.ts - a.ts);

    return {
      counts: {
        components: components.length,
        tests: tests.length,
        memoryNotes: memoryNotes.length,
        documents: documents.length,
        images: progressImages.length,
      },
      budget: {
        cap: BUDGET_CAP,
        spent,
        committed,
        remaining: BUDGET_CAP - committed,
        pct: BUDGET_CAP > 0 ? committed / BUDGET_CAP : 0,
      },
      componentStatus: statusBreakdown,
      subsystems: Array.from(subsystems.values()),
      recentTests: tests.slice(0, 5),
      recentActivity: recentActivity.slice(0, 10),
    };
  },
});
