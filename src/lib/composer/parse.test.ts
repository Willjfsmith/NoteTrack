import { describe, expect, it } from "vitest";
import { parseComposer, resolveDue } from "./parse";

const REF_DATE = new Date("2026-04-27T10:00:00Z"); // Mon 27 Apr 2026

describe("parseComposer — slash commands", () => {
  it("defaults to a note when no slash is present", () => {
    const r = parseComposer("kicked off the workshop", REF_DATE);
    expect(r.type).toBe("note");
    expect(r.body).toBe("kicked off the workshop");
    expect(r.doneShortcut).toBe(false);
  });

  it("/note keeps body without the prefix", () => {
    const r = parseComposer("/note site visit at 10", REF_DATE);
    expect(r.type).toBe("note");
    expect(r.body).toBe("site visit at 10");
  });

  it("/todo maps to action", () => {
    const r = parseComposer("/todo chase Diane", REF_DATE);
    expect(r.type).toBe("action");
  });

  it("/done flags the shortcut and maps to action", () => {
    const r = parseComposer("/done paid the comms invoice", REF_DATE);
    expect(r.type).toBe("action");
    expect(r.doneShortcut).toBe(true);
  });

  it("/decision and /risk and /call work", () => {
    expect(parseComposer("/decision skip handrail", REF_DATE).type).toBe("decision");
    expect(parseComposer("/risk lead time", REF_DATE).type).toBe("risk");
    expect(parseComposer("/call vendor follow-up", REF_DATE).type).toBe("call");
  });

  it("unknown slash word stays in body and treats as a note", () => {
    const r = parseComposer("/wat is going on", REF_DATE);
    expect(r.type).toBe("note");
    expect(r.body).toBe("/wat is going on");
  });

  it("is case-insensitive on the command", () => {
    expect(parseComposer("/RISK foo", REF_DATE).type).toBe("risk");
  });
});

describe("parseComposer — refs", () => {
  it("captures #items deduplicated and preserves them in body", () => {
    const r = parseComposer("issue with #SWG-401 and again #SWG-401 plus #CV-203", REF_DATE);
    expect(r.refs.items).toEqual(["SWG-401", "CV-203"]);
    expect(r.body).toContain("#SWG-401");
    expect(r.body).toContain("#CV-203");
  });

  it("captures @people in lowercase", () => {
    const r = parseComposer("@LR please look @sk too @lr", REF_DATE);
    expect(r.refs.people).toEqual(["lr", "sk"]);
  });

  it("does not capture refs that abut alphanumerics", () => {
    const r = parseComposer("issue#1 not a ref, also email a@b.com", REF_DATE);
    expect(r.refs.items).toEqual([]);
    expect(r.refs.people).toEqual([]);
  });

  it("handles common ref shapes — letters, digits, hyphens", () => {
    const r = parseComposer("#PID-D #ENV-AQ-3 #TNK-12", REF_DATE);
    expect(r.refs.items).toEqual(["PID-D", "ENV-AQ-3", "TNK-12"]);
  });
});

describe("parseComposer — money", () => {
  it("$1.2k is parsed as 120000 pence", () => {
    const r = parseComposer("/done $1.2k for comms cards #SWG-401", REF_DATE);
    expect(r.money).toBe(120000);
  });

  it("$2m is 200_000_000 pence", () => {
    const r = parseComposer("contract value $2m", REF_DATE);
    expect(r.money).toBe(200_000_000);
  });

  it("$500 is 50000 pence", () => {
    expect(parseComposer("$500 spent", REF_DATE).money).toBe(50000);
  });

  it("$1,500 with a thousands separator works", () => {
    expect(parseComposer("$1,500 spent", REF_DATE).money).toBe(150_000);
  });

  it("strips the money token from body", () => {
    const r = parseComposer("paid $1.2k for cards", REF_DATE);
    expect(r.body).not.toMatch(/\$/);
  });
});

describe("parseComposer — due", () => {
  it("due:today is today", () => {
    expect(parseComposer("/todo deal with it due:today", REF_DATE).due).toBe("2026-04-27");
  });

  it("due:thu is the next Thursday", () => {
    expect(parseComposer("ping vendor due:thu", REF_DATE).due).toBe("2026-04-30");
  });

  it("due:thu when today is Thursday returns next Thursday (one week)", () => {
    const thu = new Date("2026-04-30T12:00:00Z");
    expect(resolveDue("thu", thu)).toBe("2026-05-07");
  });

  it("due:2026-05-15 keeps the explicit date", () => {
    expect(parseComposer("file something due:2026-05-15", REF_DATE).due).toBe("2026-05-15");
  });

  it("due:+3d adds three days", () => {
    expect(parseComposer("nudge supplier due:+3d", REF_DATE).due).toBe("2026-04-30");
  });

  it("strips the due:token from body", () => {
    const r = parseComposer("ping vendor due:thu", REF_DATE);
    expect(r.body).not.toMatch(/due:/);
  });
});

describe("parseComposer — risk extras", () => {
  it("p:N and i:N are captured as numbers and stripped", () => {
    const r = parseComposer("/risk lead-time slipping #SWG-401 @lr p:4 i:5", REF_DATE);
    expect(r.type).toBe("risk");
    expect(r.probability).toBe(4);
    expect(r.impact).toBe(5);
    expect(r.refs.items).toEqual(["SWG-401"]);
    expect(r.refs.people).toEqual(["lr"]);
    expect(r.body).not.toMatch(/p:|i:/);
    expect(r.body).toContain("#SWG-401");
    expect(r.body).toContain("@lr");
  });

  it("rejects p:0 and p:6 by leaving probability undefined", () => {
    const r = parseComposer("/risk something p:0 i:9", REF_DATE);
    expect(r.probability).toBeUndefined();
    expect(r.impact).toBeUndefined();
  });
});

describe("parseComposer — combined fixture (the prompt's done-when example)", () => {
  it("/risk HV switchgear lead time slipping #SWG-401 @lr p:4 i:4", () => {
    const r = parseComposer(
      "/risk HV switchgear lead time slipping #SWG-401 @lr p:4 i:4",
      REF_DATE,
    );
    expect(r.type).toBe("risk");
    expect(r.probability).toBe(4);
    expect(r.impact).toBe(4);
    expect(r.refs.items).toEqual(["SWG-401"]);
    expect(r.refs.people).toEqual(["lr"]);
    expect(r.body).toBe("HV switchgear lead time slipping #SWG-401 @lr");
  });
});
