import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildSeries } from "../src/temporal/series.js";
import { allNodes } from "../src/temporal/nodes.js";
import {
  auditFinding, buildFindings, formatEvidence, spanText,
  type Evidence, type Finding,
} from "../src/report/finding.js";
import { scanText, formatViolations } from "../src/report/guard.js";
import { NARRATIVE_TEMPLATES } from "../src/report/templates.js";
import type { BirthInput } from "../src/chart/types.js";

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const base = buildBaseChart(buildChart(EXAMPLE));
const S = buildSeries(base);
const nodes = allNodes(S);
const F = buildFindings(S, nodes);

describe("**摘要 ⊆ 证据 —— 分层报告最常见的失真是摘要多出一个数**", () => {
  it("每条结论都通过审计", () => {
    for (const f of F.findings) expect(auditFinding(f), f.id).toEqual([]);
  });

  it("**反向对照：摘要里多一个证据没有的数，审计必须报出来**", () => {
    const f = F.findings[0]!;
    const tampered: Finding = {
      ...f,
      summary: { ...f.summary, text: `${f.summary.text}（同期财运指数 87.3）` },
    };
    const problems = auditFinding(tampered);
    expect(problems, "摘要凭空多了 87.3，审计却放行了").toHaveLength(1);
    expect(problems[0]).toContain("87.3");
  });

  it("**反向对照：精度改了也算对不上** —— 3.5 与 3.54 机械比对认不出是同一个数", () => {
    const ev: Evidence = { label: "峰", value: 3.5432, unit: "sigma", ref: "t" };
    expect(formatEvidence(ev)).toBe("3.54");
    const f = F.findings[0]!;
    const rounded: Finding = {
      ...f,
      summary: { ...f.summary, text: f.summary.text.replace(/-?\d+\.\d{2}/, "3.5") },
      detail: { ...f.detail, evidence: [ev] },
    };
    expect(auditFinding(rounded).length).toBeGreaterThan(0);
  });

  it("区间连字符不被读成负数 —— 「2003–2004 年」里的 2004 是范围的另一端", () => {
    const f: Finding = {
      ...F.findings[0]!,
      summary: { ...F.findings[0]!.summary, text: "某序列在 2003–2004 年最偏离常态。" },
      detail: {
        narrative: [],
        evidence: [
          { label: "进入", value: 2003, unit: "year", ref: "t" },
          { label: "退出", value: 2004, unit: "year", ref: "t" },
        ],
      },
    };
    expect(auditFinding(f)).toEqual([]);
  });

  it("摘要里的每个数都指得回一条具体证据的 ref", () => {
    for (const f of F.findings) {
      for (const e of f.detail.evidence) {
        expect(e.ref, `${f.id} 的证据 ${e.label} 没有溯源`).toMatch(/^[a-z]+:/);
      }
    }
  });
});

describe("两层", () => {
  it("默认那一句独立成句，展开层比它长", () => {
    for (const f of F.findings) {
      expect(f.summary.text).toMatch(/。$/);
      expect(f.summary.text.split("。").filter((x) => x.length > 0)).toHaveLength(1);
      expect(f.detail.narrative.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("**摘要也走模板** —— 报告层不做新判断，摘要是最容易破这条规矩的地方", () => {
    const known = new Set(NARRATIVE_TEMPLATES.map((t) => t.id));
    for (const f of F.findings) {
      expect(known).toContain(f.summary.templateId);
      for (const l of f.detail.narrative) expect(known).toContain(l.templateId);
      for (const g of f.guidance) expect(known).toContain(g.line.templateId);
    }
  });

  it("展开层必带「这是排序不是概率」的框定", () => {
    for (const f of F.findings) {
      expect(f.detail.narrative.map((l) => l.templateId)).toContain("node.scaleNote");
    }
  });

  it("id 唯一，且三个尺度都有", () => {
    const ids = F.findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(F.findings.map((f) => f.scale))).toEqual(new Set(["small", "medium", "large"]));
  });
});

describe("时点写法", () => {
  it("**权重类只报到年 —— 写成某月是它没有的精度**", () => {
    for (const scale of ["small", "medium", "large"] as const) {
      for (const n of nodes[scale].nodes) {
        const t = spanText(n);
        if (n.monthResolved) expect(t, `${n.seriesId}`).toMatch(/月/);
        else expect(t, `${n.seriesId} 报出了它没有的月精度`).not.toMatch(/月/);
      }
    }
  });

  it("不报到月的结论必带一句说明为什么", () => {
    for (const f of F.findings) {
      const ids = f.detail.narrative.map((l) => l.templateId);
      const monthly = /月/.test(f.summary.text);
      expect(ids.includes("node.monthNote"), f.id).toBe(!monthly);
    }
  });
});

describe("趋吉避凶", () => {
  it("只对压力向的节点产出 —— 不判方向的不派规避方案", () => {
    for (const f of F.findings) {
      const dir = f.summary.text.includes("偏压力");
      expect(f.guidance.length > 0, `${f.id}：${f.summary.text}`).toBe(dir);
    }
    expect(F.findings.some((f) => f.guidance.length > 0), "一条趋避都没有").toBe(true);
  });

  it("**每条趋避自带传统框定与免责导向** —— 它是最容易被单独复制走的一块", () => {
    for (const f of F.findings) {
      for (const g of f.guidance) {
        expect(g.line.text, "缺传统框定").toMatch(/传统|典籍|之说/);
        expect(g.line.text, "缺免责导向").toMatch(/不构成|请咨询/);
        // 逐条单独扫描 —— 模拟「被摘出去只剩这一句」
        expect(formatViolations(scanText(g.line.text, `${f.id}.guidance`,
          { locales: ["zh-Hans"] }))).toBe("措辞扫描通过。");
      }
    }
  });

  it("**反向对照：抽掉框定语，守卫必须拦下**", () => {
    const g = F.findings.find((f) => f.guidance.length > 0)!.guidance[0]!;
    const stripped = g.line.text
      .replace(/以上是典籍之说与盘面数值的并列，不构成任何专业建议；/, "")
      .replace(/涉及健康、法律、财务的决定请咨询持证专业人士。/, "")
      .replace(/传统趋避之说于此类时段主张/, "");
    const vs = scanText(stripped, "stripped", { locales: ["zh-Hans"] });
    expect(vs.map((v) => v.ruleId), "抽掉框定后守卫竟然放行").toContain("zh.guidance.framing");
  });

  it("诱因取自神煞，且是该节点自己的理由", () => {
    for (const f of F.findings) {
      for (const g of f.guidance) {
        if (g.trigger.length > 0) expect(g.line.text).toContain(g.trigger.split("、")[0]!);
        else expect(g.line.text).toContain("无");
      }
    }
  });

  it("一条趋避都没有时，必须说清那不等于「一生平顺」", () => {
    const none = buildFindings(S, {
      small: { ...nodes.small, nodes: [] },
      medium: { ...nodes.medium, nodes: [] },
      large: { ...nodes.large, nodes: [] },
    });
    expect(none.guidanceEmptyNote).not.toBeNull();
    expect(none.guidanceEmptyNote!.text).toMatch(/不是「一生平顺」/);
  });
});

describe("守卫", () => {
  it("全部结论文本通过措辞扫描", () => {
    const vs = [];
    for (const f of F.findings) {
      vs.push(...scanText(f.summary.text, `${f.id}.summary`, { locales: ["zh-Hans"] }));
      for (const l of f.detail.narrative) {
        vs.push(...scanText(l.text, `${f.id}.detail[${l.templateId}]`, { locales: ["zh-Hans"] }));
      }
    }
    expect(formatViolations(vs)).toBe("措辞扫描通过。");
  });
});
