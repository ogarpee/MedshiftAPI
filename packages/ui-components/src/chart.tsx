import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { cn } from "./utils";

export type ChartConfig = Record<string, { color?: string; label?: string }>;

export function ChartContainer({ children, className, config }: { children: React.ReactElement; className?: string; config?: ChartConfig }) {
  const style = Object.fromEntries(
    Object.entries(config ?? {}).flatMap(([key, value], index) => (value.color ? [[`--chart-${key}`, value.color], [`--chart-${index + 1}`, value.color]] : []))
  ) as React.CSSProperties;

  return (
    <div className={cn("ms-chart-container", className)} style={style}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

type ChartTooltipPayload = {
  dataKey?: number | string;
  name?: number | string;
  value?: number | string;
};

type ChartTooltipContentProps = {
  active?: boolean;
  label?: number | string;
  payload?: ChartTooltipPayload[];
};

export function ChartTooltip() {
  return <RechartsTooltip cursor={{ fill: "rgba(11, 31, 58, 0.05)" }} content={<ChartTooltipContent />} />;
}

export function ChartTooltipContent({ active, label, payload }: ChartTooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="ms-chart-tooltip">
      {label ? <strong>{label}</strong> : null}
      {payload.map((item) => (
        <span key={item.dataKey?.toString()}>
          {item.name ?? item.dataKey}: <b>{item.value}</b>
        </span>
      ))}
    </div>
  );
}

export function SimpleBarChart({
  data,
  dataKey,
  nameKey,
  valueLabel = "Value"
}: {
  data: Array<Record<string, number | string>>;
  dataKey: string;
  nameKey: string;
  valueLabel?: string;
}) {
  return (
    <ChartContainer config={{ [dataKey]: { color: "var(--gold)", label: valueLabel } }}>
      <BarChart data={data} margin={{ bottom: 4, left: -24, right: 8, top: 8 }}>
        <CartesianGrid stroke="rgba(11,31,58,0.08)" vertical={false} />
        <XAxis axisLine={false} dataKey={nameKey} tickLine={false} tick={{ fill: "rgba(11,31,58,0.52)", fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(11,31,58,0.52)", fontSize: 12 }} />
        <ChartTooltip />
        <Bar dataKey={dataKey} fill="var(--chart-1)" name={valueLabel} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
