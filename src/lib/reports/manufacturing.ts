import "server-only";
import { num, num0 } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dates";
import { CUT_STYLE_LABELS } from "@/lib/cuts";
import { PROCESS_LABELS } from "@/lib/process";
import { r2, r3 } from "@/lib/reports/format";
import type { ReportResult, ReportRow } from "@/lib/reports/types";
import { groupBy, monthOf, periodOf, sum, type ReportDef } from "@/lib/reports/common";

// Loss on returns: issue weight − return weight, against the limit that
// applied, by stage and karigar.
export const lossReport: ReportDef = {
  key: "loss",
  title: "Loss report",
  description: "Weight lost on each return (or totals by stage, karigar or month), with excess-loss flags.",
  group: "Manufacturing",
  permissions: ["mfg.reports"],
  filters: ["from", "to", "stage", "karigar", "flag", "groupBy"],
  defaultPeriod: true,
  choices: {
    flag: [
      { value: "", label: "All returns" },
      { value: "excess", label: "Excess loss only" },
    ],
    groupBy: [
      { value: "", label: "Each return" },
      { value: "stage", label: "Stage" },
      { value: "karigar", label: "Karigar / department" },
      { value: "month", label: "Month" },
    ],
  },
  async build(f): Promise<ReportResult> {
    const period = periodOf(f, true)!;
    const moves = await prisma.processMovement.findMany({
      where: {
        voidedAt: null,
        returnDate: { gte: period.start, lt: period.end },
        ...(f.stage ? { stageId: f.stage } : {}),
        ...(f.karigar ? { partyId: f.karigar } : {}),
        ...(f.flag === "excess" ? { isExcessLoss: true } : {}),
      },
      include: {
        product: { select: { id: true, sku: true } },
        party: { select: { name: true } },
        toDepartment: { select: { name: true } },
        stage: { select: { name: true } },
      },
      orderBy: { returnDate: "asc" },
      take: 20000,
    });
    const rows = moves.map((m) => {
      const issue = num0(m.issueWeight);
      const ret = num0(m.returnWeight);
      const loss = m.lossWeight !== null ? Number(m.lossWeight) : issue - ret;
      return {
        m,
        stage: m.stage?.name ?? (m.process ? (PROCESS_LABELS[m.process] ?? m.process) : "—"),
        worker: m.party?.name ?? (m.toDepartment ? `${m.toDepartment.name} (dept)` : "—"),
        issue,
        ret,
        loss,
      };
    });
    const totalIssue = sum(rows, (r) => r.issue);
    const totalLoss = sum(rows, (r) => r.loss);
    const totals = {
      returns: rows.length,
      issue: r3(totalIssue),
      ret: r3(sum(rows, (r) => r.ret)),
      loss: r3(totalLoss),
      lossPct: totalIssue > 0 ? r2((totalLoss / totalIssue) * 100) : null,
      excess: rows.filter((r) => r.m.isExcessLoss).length,
    };
    const subtitle = `Returns ${period.label}${f.flag === "excess" ? " · excess loss only" : ""}`;

    if (f.groupBy === "stage" || f.groupBy === "karigar" || f.groupBy === "month") {
      const key = (r: (typeof rows)[number]) =>
        f.groupBy === "stage" ? r.stage : f.groupBy === "karigar" ? r.worker : monthOf(r.m.returnDate!);
      const groups = [...groupBy(rows, key).entries()].sort((a, b) => (f.groupBy === "month" ? a[0].localeCompare(b[0]) : sum(b[1], (r) => r.loss) - sum(a[1], (r) => r.loss)));
      return {
        title: "Loss report",
        subtitle,
        columns: [
          { key: "group", header: f.groupBy === "stage" ? "Stage" : f.groupBy === "karigar" ? "Karigar / department" : "Month", width: 28 },
          { key: "returns", header: "Returns", kind: "int" },
          { key: "issue", header: "Issued ct", kind: "carat" },
          { key: "ret", header: "Returned ct", kind: "carat" },
          { key: "loss", header: "Loss ct", kind: "carat" },
          { key: "lossPct", header: "Loss %", kind: "pct" },
          { key: "excess", header: "Excess", kind: "int" },
        ],
        rows: groups.map(([group, g]) => {
          const issue = sum(g, (r) => r.issue);
          const loss = sum(g, (r) => r.loss);
          return {
            group,
            returns: g.length,
            issue: r3(issue),
            ret: r3(sum(g, (r) => r.ret)),
            loss: r3(loss),
            lossPct: issue > 0 ? r2((loss / issue) * 100) : null,
            excess: g.filter((r) => r.m.isExcessLoss).length,
          };
        }),
        totals: { group: "Total", ...totals },
      };
    }

    return {
      title: "Loss report",
      subtitle,
      columns: [
        { key: "date", header: "Returned" },
        { key: "stone", header: "Stone", hrefKey: "href" },
        { key: "stage", header: "Stage" },
        { key: "worker", header: "Karigar / department", width: 26 },
        { key: "issue", header: "Issued ct", kind: "carat" },
        { key: "ret", header: "Returned ct", kind: "carat" },
        { key: "loss", header: "Loss ct", kind: "carat" },
        { key: "lossPct", header: "Loss %", kind: "pct" },
        { key: "limit", header: "Allowed %", kind: "pct" },
        { key: "excess", header: "Excess" },
        { key: "reason", header: "Reason", width: 30 },
      ],
      rows: rows.map((r): ReportRow => ({
        date: formatDate(r.m.returnDate),
        stone: r.m.product.sku,
        href: `/stones/${r.m.product.id}`,
        stage: r.stage,
        worker: r.worker,
        issue: r3(r.issue),
        ret: r3(r.ret),
        loss: r3(r.loss),
        lossPct: r.m.lossPct !== null ? r2(Number(r.m.lossPct)) : r.issue > 0 ? r2((r.loss / r.issue) * 100) : null,
        limit: r.m.lossLimitPct !== null ? r2(Number(r.m.lossLimitPct)) : null,
        excess: r.m.isExcessLoss ? "Yes" : "",
        reason: r.m.excessReason ?? "",
      })),
      totals: { date: "Total", stone: `${totals.returns} returns`, issue: totals.issue, ret: totals.ret, loss: totals.loss, lossPct: totals.lossPct, excess: `${totals.excess}` },
    };
  },
};

// Rough to polished: polished weight ÷ rough weight, and against the plan.
export const yieldReport: ReportDef = {
  key: "yield",
  title: "Yield report",
  description: "Rough weight to polished weight per stone, lot or cut — with planned weight where a plan exists.",
  group: "Manufacturing",
  permissions: ["mfg.reports"],
  filters: ["from", "to", "lot", "cutStyle", "shape", "groupBy"],
  defaultPeriod: false,
  choices: {
    groupBy: [
      { value: "", label: "Each stone" },
      { value: "lot", label: "Lot" },
      { value: "cut", label: "Cut style" },
    ],
  },
  async build(f): Promise<ReportResult> {
    const period = periodOf(f, false);
    const stones = await prisma.polishedStone.findMany({
      where: {
        ...(period ? { createdAt: { gte: period.start, lt: period.end } } : {}),
        ...(f.cutStyle ? { cutStyle: f.cutStyle } : {}),
        ...(f.shape ? { shape: { equals: f.shape, mode: "insensitive" as const } } : {}),
        ...(f.lot ? { sourceProduct: { lotId: f.lot } } : {}),
      },
      include: {
        sourceProduct: {
          select: {
            id: true,
            sku: true,
            roughWeight: true,
            lot: { select: { lotNumber: true } },
            plans: { where: { isFinal: true }, orderBy: { version: "desc" }, take: 1, select: { plannedWeight: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 20000,
    });
    const rows = stones.map((p) => {
      const rough = p.sourceProduct.roughWeight !== null ? Number(p.sourceProduct.roughWeight) : null;
      const planned = p.sourceProduct.plans[0] ? Number(p.sourceProduct.plans[0].plannedWeight) : null;
      return { p, rough, planned, polished: num(p.caratWeight) };
    });
    // Yield totals only count stones with both weights.
    const counted = rows.filter((r) => r.rough && r.polished);
    const agg = (g: typeof rows) => {
      const c = g.filter((r) => r.rough && r.polished);
      const rough = sum(c, (r) => r.rough);
      const polished = sum(c, (r) => r.polished);
      const withPlan = c.filter((r) => r.planned);
      const plannedRough = sum(withPlan, (r) => r.rough);
      return {
        stones: g.length,
        rough: r3(sum(g, (r) => r.rough)),
        polished: r3(sum(g, (r) => r.polished)),
        yieldPct: rough > 0 ? r2((polished / rough) * 100) : null,
        plannedPct: plannedRough > 0 ? r2((sum(withPlan, (r) => r.planned) / plannedRough) * 100) : null,
      };
    };
    const subtitle = period ? `Transferred to Polish ${period.label}` : "All polished stones";
    const notes = rows.length > counted.length ? [`${rows.length - counted.length} stones without a rough or polished weight are left out of the yield %.`] : undefined;

    if (f.groupBy === "lot" || f.groupBy === "cut") {
      const key = (r: (typeof rows)[number]) =>
        f.groupBy === "lot" ? (r.p.sourceProduct.lot?.lotNumber ?? "No lot") : r.p.cutStyle ? (CUT_STYLE_LABELS[r.p.cutStyle] ?? r.p.cutStyle) : "Not set";
      return {
        title: "Yield report",
        subtitle,
        columns: [
          { key: "group", header: f.groupBy === "lot" ? "Lot" : "Cut style", width: 24 },
          { key: "stones", header: "Stones", kind: "int" },
          { key: "rough", header: "Rough ct", kind: "carat" },
          { key: "polished", header: "Polished ct", kind: "carat" },
          { key: "yieldPct", header: "Yield %", kind: "pct" },
          { key: "plannedPct", header: "Planned yield %", kind: "pct" },
        ],
        rows: [...groupBy(rows, key).entries()].map(([group, g]) => ({ group, ...agg(g) })),
        totals: { group: "Total", ...agg(rows) },
        notes,
      };
    }

    return {
      title: "Yield report",
      subtitle,
      columns: [
        { key: "stockId", header: "Stock ID", hrefKey: "href" },
        { key: "sku", header: "Stone" },
        { key: "lot", header: "Lot" },
        { key: "cut", header: "Cut" },
        { key: "rough", header: "Rough ct", kind: "carat" },
        { key: "planned", header: "Planned ct", kind: "carat" },
        { key: "polished", header: "Polished ct", kind: "carat" },
        { key: "yieldPct", header: "Yield %", kind: "pct" },
        { key: "vsPlan", header: "vs plan %", kind: "pct" },
      ],
      rows: rows.map((r): ReportRow => ({
        stockId: r.p.stockId,
        href: `/polish/${r.p.id}`,
        sku: r.p.sourceProduct.sku,
        lot: r.p.sourceProduct.lot?.lotNumber ?? "",
        cut: r.p.cutStyle ? (CUT_STYLE_LABELS[r.p.cutStyle] ?? r.p.cutStyle) : "",
        rough: r.rough,
        planned: r.planned,
        polished: r.polished,
        yieldPct: r.rough && r.polished ? r2((r.polished / r.rough) * 100) : null,
        vsPlan: r.planned && r.polished ? r2(((r.polished - r.planned) / r.planned) * 100) : null,
      })),
      totals: (() => {
        const t = agg(rows);
        return { stockId: `${t.stones} stones`, rough: t.rough, polished: t.polished, yieldPct: t.yieldPct };
      })(),
      notes,
    };
  },
};
