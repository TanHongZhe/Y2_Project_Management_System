export interface MemoryBlock {
  type: "p" | "ul" | "ol" | "kv";
  text?: string;
  items?: string[];
  rows?: [string, string][];
}

export interface MemorySection {
  id: string;
  title: string;
  author: string;
  updated: string;
  content: MemoryBlock[];
}

export interface Decision {
  id: string;
  date: string;
  title: string;
  why: string;
  tags: string[];
}

export interface Component {
  id: string;
  part: string;
  model: string;
  supplier: string;
  specs: string;
  datasheet: string;
  status: "installed" | "received" | "ordered" | "planned";
  cost: number;
}

export interface TestSubsystem {
  id: string;
  name: string;
  sub: string;
  count: number;
}

export interface Test {
  id: string;
  subsystem: string;
  title: string;
  date: string;
  author: string;
  conditions: string;
  notes: string;
  metrics: [string, string, string][];
}

export interface DocItem {
  name: string;
  size: string;
}

export interface DocGroup {
  group: string;
  items: DocItem[];
}

export interface ActivityItem {
  ts: string;
  who: "ai" | "you";
  what: string;
}

export interface AppData {
  project: {
    id: string;
    name: string;
    course: string;
    semester: string;
    started: string;
    lastSync: string;
    budgetCap: number;
  };
  memorySections: MemorySection[];
  decisions: Decision[];
  components: Component[];
  testSubsystems: TestSubsystem[];
  tests: Test[];
  docs: DocGroup[];
  recentMemoryActivity: ActivityItem[];
}

export const APP_DATA: AppData = {
  project: {
    id: "Y2-PMS-001",
    name: "Solar Bus Demonstrator",
    course: "ENG2-SYS",
    semester: "Spring 26",
    started: "2026-02-04",
    lastSync: "2026-05-14 11:42",
    budgetCap: 60.0,
  },

  memorySections: [
    {
      id: "overview",
      title: "Project Overview",
      author: "you",
      updated: "2026-04-22",
      content: [
        { type: "p", text: "Indoor demonstrator for a small autonomous power system: a 4-cell PV panel charges a 100 F supercapacitor stack through an MPPT-style buck converter; a second SMPS regulates the bus to 3.3 V to drive an LED string and a STM32-based comms board." },
        { type: "kv", rows: [
          ["bus_target", "3.30 V ± 2 %"],
          ["pv_open_circuit", "8.4 V (indoor, ~600 lux)"],
          ["supercap_stack", "2 × 50 F @ 2.7 V, balanced"],
          ["led_load", "5 V → 20 mA × 8"],
          ["report_due", "2026-06-09"],
        ] }
      ]
    },
    {
      id: "bus-voltage",
      title: "Bus Voltage",
      author: "ai",
      updated: "2026-05-12",
      content: [
        { type: "p", text: "Bus is held at **3.30 V** by the secondary buck. Tolerance budget assumes ±2 % static load regulation; ripple target ≤ 50 mVpp at 20 mA load. Bench prototype meets this at room temp; needs verification once the LED PWM is enabled (expect injected ripple at 1 kHz)." },
        { type: "ul", items: [
          "Switch frequency: 500 kHz (synced to MCU TIM3 if possible).",
          "Inductor: 47 µH, 1 A sat (Coilcraft XAL5030-473).",
          "Bulk caps: 22 µF X5R on input, 47 µF X7R on output.",
          "Feedback divider: 10 k / 16.9 k → 3.30 V nominal.",
        ] }
      ]
    },
    {
      id: "smps-roles",
      title: "SMPS Roles",
      author: "you",
      updated: "2026-04-30",
      content: [
        { type: "kv", rows: [
          ["U1 — Primary MPPT buck", "PV (4–8 V) → Supercap stack (≤ 5.4 V). P&O firmware-driven."],
          ["U2 — Bus regulator", "Supercap (1.8–5.4 V) → 3.30 V rail. Buck-boost; sync to MCU clock."],
          ["U3 — LED driver", "3.30 V → 5 V constant-current sink @ 20 mA × 8. PWM dimmable."],
        ] },
        { type: "p", text: "Current decision (D-007) keeps U3 separate from U2 to avoid loop interaction during PWM dimming." }
      ]
    },
    {
      id: "components",
      title: "Components",
      author: "ai",
      updated: "2026-05-14",
      content: [
        { type: "p", text: "Component register is the source of truth; this section auto-summarises. As of last sync: **9 parts ordered, 6 received, 3 installed**, running spend **£42.85 / £60.00**." }
      ]
    },
    {
      id: "test-results",
      title: "Test Results",
      author: "ai",
      updated: "2026-05-13",
      content: [
        { type: "p", text: "Latest indoor MPPT sweep settled at **6.2 V, 0.42 A** (≈2.6 W) under bench lamp at 30 cm. Supercap charge from 1.0 V → 4.8 V in 14 min 28 s." },
        { type: "p", text: "Open: ripple measurement under LED PWM is still pending; STM32 firmware locks up if I2C runs concurrent with PWM ISR (see open question Q-003)." }
      ]
    },
    {
      id: "open-questions",
      title: "Open Questions",
      author: "you",
      updated: "2026-05-10",
      content: [
        { type: "ol", items: [
          "Q-001 — Can we share the buck-boost clock with the MCU without injecting jitter on the PWM line?",
          "Q-002 — Is the 3.3 Ω 50 W bleed resistor really necessary, or does the buck-boost sink enough to discharge the stack at end of demo?",
          "Q-003 — STM32 I2C bus locks when PWM ISR fires every 200 µs. DMA or coarser PWM?",
        ] }
      ]
    },
    {
      id: "decisions",
      title: "Decision Log",
      author: "you",
      updated: "2026-05-12",
      content: [
        { type: "p", text: "Chronological decisions live in the dedicated Decisions tab. This section is a roll-up." },
        { type: "ul", items: [
          "D-001 — 3.30 V bus chosen over 5 V (lower idle losses).",
          "D-007 — Keep LED driver as a separate SMPS stage.",
          "D-009 — Defer RAG; rely on long-context Flash for week 5.",
        ] }
      ]
    },
  ],

  decisions: [
    { id: "D-010", date: "2026-05-12", title: "Defer RAG; rely on long-context Gemini Flash for the demo.", why: "Project corpus is ~40 kB total; well under Flash's window. Re-evaluate if context bleed becomes an issue in week 6.", tags: ["arch"] },
    { id: "D-009", date: "2026-05-08", title: "Use OpenRouter as the model gateway, not vendor SDKs.", why: "Single key, single billing surface, easy to A/B Flash vs Sonnet for the Boost button.", tags: ["arch"] },
    { id: "D-008", date: "2026-05-02", title: "Order 3.3 Ω 50 W bleed resistor from Farnell.", why: "Needed for safe end-of-demo discharge of the supercap stack. Budget impact £4.12.", tags: ["bom", "cost"] },
    { id: "D-007", date: "2026-04-28", title: "Keep LED driver as a separate SMPS stage (U3).", why: "Avoids feedback-loop interaction between the bus regulator and PWM dimming. Adds one IC, simplifies tuning.", tags: ["pv"] },
    { id: "D-006", date: "2026-04-19", title: "MPPT algorithm: Perturb-and-Observe, not Incremental Conductance.", why: "P&O is well-understood, fits in flash, marker likely expects it. IncCond can be a stretch goal.", tags: ["pv"] },
    { id: "D-005", date: "2026-04-09", title: "Supercap stack: 2 × 50 F balanced, not single 100 F.", why: "Balancing resistors are cheaper than a single 5.4 V cap; voltage headroom on each cell is more forgiving.", tags: ["bom"] },
    { id: "D-004", date: "2026-03-27", title: "Inductor choice: Coilcraft XAL5030-473.", why: "47 µH, 1 A sat — matches calculated ripple at 500 kHz; in stock at Farnell; SMD package fits the board.", tags: ["bom"] },
    { id: "D-003", date: "2026-03-12", title: "Switch frequency 500 kHz.", why: "Sweet spot between magnetic size and switching losses for the 1 A bus load.", tags: ["bus"] },
    { id: "D-002", date: "2026-02-25", title: "Bus voltage: 3.30 V, not 5.0 V.", why: "Lower idle losses and matches the MCU rail directly. LED driver does the 5 V step-up locally.", tags: ["bus"] },
    { id: "D-001", date: "2026-02-11", title: "Indoor demo, not outdoor.", why: "Cannot guarantee daylight on demo day; bench lamp at 30 cm gives reproducible 600 lux.", tags: ["bus"] },
  ],

  components: [
    { id: "C-01", part: "Buck IC, primary", model: "TPS62933PDRLR", supplier: "Mouser", specs: "3.8–17 V in, 3 A, 1.2 MHz", datasheet: "tps62933.pdf", status: "installed", cost: 1.62 },
    { id: "C-02", part: "Buck-boost IC", model: "TPS63802YFFR", supplier: "Mouser", specs: "1.8–5.5 V → 1.8–5.2 V, 2 A", datasheet: "tps63802.pdf", status: "installed", cost: 2.45 },
    { id: "C-03", part: "LED driver", model: "TLC5947RHB", supplier: "Farnell", specs: "24-ch constant-current, 30 mA", datasheet: "tlc5947.pdf", status: "received", cost: 6.18 },
    { id: "C-04", part: "MCU", model: "STM32G031K8T6", supplier: "Farnell", specs: "Cortex-M0+, 64 KB flash", datasheet: "stm32g031.pdf", status: "installed", cost: 3.84 },
    { id: "C-05", part: "Inductor", model: "Coilcraft XAL5030-473MEC", supplier: "Farnell", specs: "47 µH, 1 A sat", datasheet: "xal5030.pdf", status: "received", cost: 1.95 },
    { id: "C-06", part: "Supercap, 50 F × 2", model: "Kemet FC0H503ZF", supplier: "Mouser", specs: "50 F, 2.7 V, ESR 25 mΩ", datasheet: "fc0h503.pdf", status: "received", cost: 14.20 },
    { id: "C-07", part: "Bleed resistor", model: "Vishay RH050", supplier: "Farnell", specs: "3.3 Ω 50 W chassis-mount", datasheet: "rh050.pdf", status: "ordered", cost: 4.12 },
    { id: "C-08", part: "PV panel", model: "SunPower SP-7-PE", supplier: "RS", specs: "7 V open-circuit, 200 mA", datasheet: "sp7pe.pdf", status: "received", cost: 6.40 },
    { id: "C-09", part: "Schottky diode", model: "PMEG2010EH", supplier: "Mouser", specs: "20 V, 1 A, V_F 0.35 V", datasheet: "pmeg2010.pdf", status: "received", cost: 0.34 },
    { id: "C-10", part: "Sense resistor", model: "WSL1206R0500FEA", supplier: "Mouser", specs: "0.05 Ω, 1 %, 0.5 W", datasheet: "wsl1206.pdf", status: "ordered", cost: 0.85 },
    { id: "C-11", part: "I²C buffer", model: "PCA9517DR", supplier: "Mouser", specs: "Level-shift 1.8/3.3 V", datasheet: "pca9517.pdf", status: "planned", cost: 0.92 },
    { id: "C-12", part: "JST connectors", model: "PH 2-pin set", supplier: "Farnell", specs: "2 mm pitch, 2 A", datasheet: "jst-ph.pdf", status: "received", cost: 0.78 },
  ],

  testSubsystems: [
    { id: "pv", name: "PV + MPPT", sub: "U1, panel", count: 6 },
    { id: "supercap", name: "Supercap stack", sub: "C-06, balancing", count: 4 },
    { id: "bus", name: "Bus regulator", sub: "U2, 3.30 V rail", count: 5 },
    { id: "led", name: "LED driver", sub: "U3, 8 × 20 mA", count: 3 },
    { id: "comms", name: "Comms / I²C", sub: "MCU bus", count: 2 },
    { id: "system", name: "System integration", sub: "end-to-end", count: 1 },
  ],

  tests: [
    { id: "T-021", subsystem: "pv", title: "Indoor MPPT sweep, bench lamp @ 30 cm", date: "2026-05-13 14:22", author: "you",
      conditions: "Bench lamp (Anglepoise LED, 9 W) @ 30 cm vertical, room 21 °C. P&O step = 50 mV / 200 ms.",
      notes: "Settled within ~4 s. Oscillation amplitude smaller than expected; possibly because of supercap effective impedance dominating.",
      metrics: [["V_mp", "6.20", "V"], ["I_mp", "0.42", "A"], ["P_mp", "2.60", "W"]] },
    { id: "T-020", subsystem: "supercap", title: "Stack charge time, 1.0 V → 4.8 V", date: "2026-05-12 16:08", author: "you",
      conditions: "Same MPPT setup as T-021. Cells balanced via 22 kΩ.",
      notes: "Balancing currents <1 mA, OK. End voltage 4.79 V (one cell at 2.42, other at 2.37 — within balance window).",
      metrics: [["t_charge", "14:28", "mm:ss"], ["ΔV", "3.80", "V"], ["E", "904", "J"]] },
    { id: "T-019", subsystem: "bus", title: "3.30 V rail load regulation 0 → 1 A", date: "2026-05-10 11:40", author: "you",
      conditions: "Electronic load swept 0 → 1 A. Input from bench supply @ 4.0 V.",
      notes: "Sag −38 mV at 1 A. Within ±2 % spec. Have not yet tested at supercap min (1.8 V).",
      metrics: [["ΔV_load", "−38", "mV"], ["ΔV/Δi", "38", "mV/A"], ["η @ 0.5 A", "91", "%"]] },
    { id: "T-018", subsystem: "led", title: "LED PWM dimming 0–100 %", date: "2026-05-08 09:55", author: "ai",
      conditions: "8 × red LEDs, 20 mA full. Carrier 1 kHz, duty 0/25/50/75/100.",
      notes: "Brightness visibly linear above ~10 %. Audible buzz from inductor at 50 % — investigate ferrite damping.",
      metrics: [["I_full", "159", "mA"], ["f_PWM", "1.00", "kHz"], ["audible noise", "yes", ""]] },
    { id: "T-017", subsystem: "bus", title: "Ripple under LED PWM", date: "2026-05-09 17:11", author: "you",
      conditions: "Scope on 3.30 V rail, 20 MHz BW. PWM duty 50 %.",
      notes: "Spike pairs at PWM transitions — peak 95 mVpp. Exceeds 50 mV target; need either softer LED gate drive or larger output cap.",
      metrics: [["V_pp", "95", "mV"], ["f_meas", "1.0", "kHz"], ["BW", "20", "MHz"]] },
  ],

  docs: [
    { group: "README & plan", items: [
      { name: "README.md", size: "4.2 kB" },
      { name: "project-plan.md", size: "6.8 kB" },
      { name: "marker-criteria.pdf", size: "112 kB" },
    ]},
    { group: "Schematics", items: [
      { name: "schematic-rev3.pdf", size: "284 kB" },
      { name: "pcb-layout-rev3.pdf", size: "1.2 MB" },
      { name: "bom-rev3.csv", size: "3.1 kB" },
    ]},
    { group: "Datasheets", items: [
      { name: "tps62933.pdf", size: "812 kB" },
      { name: "tps63802.pdf", size: "904 kB" },
      { name: "tlc5947.pdf", size: "1.1 MB" },
      { name: "stm32g031.pdf", size: "8.4 MB" },
      { name: "fc0h503.pdf", size: "412 kB" },
    ]},
    { group: "Firmware", items: [
      { name: "mppt.c", size: "5.1 kB" },
      { name: "led_pwm.c", size: "2.4 kB" },
      { name: "main.c", size: "3.7 kB" },
    ]},
  ],

  recentMemoryActivity: [
    { ts: "11:42", who: "ai", what: "Appended T-021 result to Test Results" },
    { ts: "11:39", who: "ai", what: "Logged decision D-010 (defer RAG)" },
    { ts: "10:22", who: "you", what: "Edited SMPS Roles" },
    { ts: "Yesterday", who: "ai", what: "Set bleed resistor C-07 → ordered" },
    { ts: "Yesterday", who: "you", what: "Added open question Q-003" },
  ],
};
