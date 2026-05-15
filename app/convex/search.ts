import { v } from "convex/values";
import { query } from "./_generated/server";

export const globalSearch = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const term = q.trim();
    if (term.length < 2) {
      return { components: [], decisions: [], memory: [], tests: [], meetings: [], chunks: [] };
    }

    const [componentsByName, allComponents, decisions, memoryByContent, allMemory, tests, meetingsByContent, allMeetings, chunks] = await Promise.all([
      ctx.db
        .query("components")
        .withSearchIndex("search_name", (sq) => sq.search("name", term))
        .take(5),
      ctx.db.query("components").collect(),
      ctx.db
        .query("decisions")
        .withSearchIndex("search_title", (sq) => sq.search("title", term))
        .take(5),
      ctx.db
        .query("memoryNotes")
        .withSearchIndex("search_content", (sq) => sq.search("content", term))
        .take(4),
      ctx.db.query("memoryNotes").collect(),
      ctx.db
        .query("tests")
        .withSearchIndex("search_title", (sq) => sq.search("title", term))
        .take(4),
      ctx.db
        .query("meetingNotes")
        .withSearchIndex("search_content", (sq) => sq.search("content", term))
        .take(4),
      ctx.db.query("meetingNotes").collect(),
      ctx.db
        .query("chunks")
        .withSearchIndex("search_text", (sq) => sq.search("text", term))
        .take(6),
    ]);

    const lc = term.toLowerCase();

    // Components: merge name-index results with model/ref/supplier substring matches
    const seenComponents = new Set<string>();
    const components: typeof componentsByName = [];
    for (const c of componentsByName) { seenComponents.add(c._id); components.push(c); }
    for (const c of allComponents) {
      if (!seenComponents.has(c._id) && (
        c.model?.toLowerCase().includes(lc) ||
        c.ref.toLowerCase().includes(lc) ||
        c.supplier?.toLowerCase().includes(lc)
      )) { seenComponents.add(c._id); components.push(c); }
    }
    components.splice(8);

    // Memory: merge content-index results with section name substring matches
    const seenMemory = new Set<string>();
    const memory: typeof memoryByContent = [];
    for (const n of memoryByContent) { seenMemory.add(n._id); memory.push(n); }
    for (const n of allMemory) {
      if (!seenMemory.has(n._id) && n.section.toLowerCase().includes(lc)) {
        seenMemory.add(n._id); memory.push(n);
      }
    }
    memory.splice(6);

    // Meetings: merge content-index results with title substring matches
    const seenMeetings = new Set<string>();
    const meetings: typeof meetingsByContent = [];
    for (const m of meetingsByContent) { seenMeetings.add(m._id); meetings.push(m); }
    for (const m of allMeetings) {
      if (!seenMeetings.has(m._id) && m.title.toLowerCase().includes(lc)) {
        seenMeetings.add(m._id); meetings.push(m);
      }
    }
    meetings.splice(6);

    return { components, decisions, memory, tests, meetings, chunks };
  },
});
