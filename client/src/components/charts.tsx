import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useTheme } from "../theme";
import { formatKRW, formatKRWShort } from "../format";
import {
  categoryColor,
  chartInk,
  incomeExpenseColors,
  fixedVariableColors,
  OTHER_COLOR,
} from "../palette";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--text)",
};

function monthTick(ym: string): string {
  return `${Number(ym.slice(5, 7))}월`;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  totalExpense: number;
}

/** 월별 수입/지출 추이 — 단일 축, 2계열 그룹 막대 (FR-1.2) */
export function MonthlyTrendChart({ data }: { data: MonthlyPoint[] }) {
  const { theme } = useTheme();
  const ink = chartInk(theme);
  const colors = incomeExpenseColors(theme);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={ink.grid} vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthTick} tick={{ fill: ink.text, fontSize: 12 }} axisLine={{ stroke: ink.grid }} tickLine={false} />
        <YAxis tickFormatter={formatKRWShort} tick={{ fill: ink.text, fontSize: 12 }} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: ink.grid, opacity: 0.4 }}
          formatter={(v: number) => formatKRW(v)}
          labelFormatter={(l: string) => `${l.slice(0, 4)}년 ${monthTick(l)}`}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: ink.text }} />
        <Bar name="수입" dataKey="income" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar name="지출" dataKey="totalExpense" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface DonutSlice {
  name: string;
  value: number;
}

/** 카테고리별 지출 도넛 — top N + "그 외" 폴딩, 5% 이상 슬라이스 직접 라벨 (FR-1.3) */
export function CategoryDonut({ byCategory }: { byCategory: Record<string, number> }) {
  const { theme } = useTheme();
  const ink = chartInk(theme);

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 7);
  const restSum = entries.slice(7).reduce((s, [, v]) => s + v, 0);
  const data: DonutSlice[] = [
    ...top.map(([name, value]) => ({ name, value })),
    ...(restSum > 0 ? [{ name: "그 외", value: restSum }] : []),
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="empty">이 달의 지출 데이터가 없습니다.</p>;

  const colorOf = (name: string) => (name === "그 외" ? OTHER_COLOR[theme] : categoryColor(name, theme));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          stroke={ink.surface}
          strokeWidth={2}
          label={(p) =>
            p.value / total >= 0.05 ? `${p.name} ${Math.round((p.value / total) * 100)}%` : ""
          }
          labelLine={false}
          fontSize={12}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={colorOf(d.name)} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [formatKRW(v), name]} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 12, color: ink.text }}
          formatter={(name: string) => {
            const item = data.find((d) => d.name === name);
            return `${name} · ${formatKRWShort(item?.value ?? 0)}`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export interface FixedVariablePoint {
  month: string;
  fixed: number;
  variable: number;
}

/** 고정 vs 변동 지출 스택 막대 (FR-2.6) — 세그먼트 사이 2px 서피스 갭 */
export function FixedVariableChart({ data }: { data: FixedVariablePoint[] }) {
  const { theme } = useTheme();
  const ink = chartInk(theme);
  const colors = fixedVariableColors(theme);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={ink.grid} vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthTick} tick={{ fill: ink.text, fontSize: 12 }} axisLine={{ stroke: ink.grid }} tickLine={false} />
        <YAxis tickFormatter={formatKRWShort} tick={{ fill: ink.text, fontSize: 12 }} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: ink.grid, opacity: 0.4 }}
          formatter={(v: number) => formatKRW(v)}
          labelFormatter={(l: string) => `${l.slice(0, 4)}년 ${monthTick(l)}`}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: ink.text }} />
        <Bar name="고정지출" dataKey="fixed" stackId="a" fill={colors.fixed} stroke={ink.surface} strokeWidth={2} maxBarSize={36} />
        <Bar name="변동지출" dataKey="variable" stackId="a" fill={colors.variable} stroke={ink.surface} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
