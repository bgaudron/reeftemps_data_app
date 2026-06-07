import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { observationsQueryOptions, datastreamQueryOptions } from "@/api/sta";
import type { ObservationPoint } from "@/types/sta";

const MAX_POINTS = 2000;
const YAXIS_WIDTH = 44;

const PARAM_COLORS = [
  "#0ea5e9",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#f59e0b",
  "#6366f1",
  "#ec4899",
  "#84cc16",
];

function downsample(pts: ObservationPoint[], max: number): ObservationPoint[] {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  return pts.filter((_, i) => i % step === 0);
}

interface TooltipPayloadItem { value?: number }
interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  unit: string;
  paramLabel: string;
}

function ChartTooltip({ active, payload, label, unit, paramLabel }: ChartTooltipProps) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 shadow-lg">
      <p className="text-slate-400 text-[11px] mb-1">
        {new Date(label).toLocaleString("fr-FR")}
      </p>
      <p className="text-slate-900 text-sm font-semibold tabular-nums">
        {payload[0].value} {unit}
      </p>
      {paramLabel && (
        <p className="text-slate-400 text-[10px] mt-0.5">{paramLabel}</p>
      )}
    </div>
  );
}

interface TimeSeriesChartProps {
  serieId: number;
  observedPropertyId?: number;
}

export function TimeSeriesChart({ serieId, observedPropertyId }: TimeSeriesChartProps) {
  const color = PARAM_COLORS[(observedPropertyId ?? 0) % PARAM_COLORS.length];
  const { data: observations = [], isPending } = useQuery(observationsQueryOptions(serieId));
  const { data: ds } = useQuery(datastreamQueryOptions(serieId));

  const unit = ds?.unitOfMeasurement?.name ?? "";
  const paramLabel = ds?.ObservedProperty?.description ?? "";

  const displayData = useMemo(() => downsample(observations, MAX_POINTS), [observations]);

  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  useEffect(() => { setZoomDomain(null); }, [serieId]);

  const xDomain: [number | string, number | string] = zoomDomain ?? ["auto", "auto"];

  const yDomain = useMemo<[number | string, number | string]>(() => {
    const visible = zoomDomain
      ? displayData.filter(d => d.time >= zoomDomain[0] && d.time <= zoomDomain[1])
      : displayData;
    if (!visible.length) return ["auto", "auto"];
    const vals = visible.map(d => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.1 || 0.5;
    return [+(min - pad).toFixed(4), +(max + pad).toFixed(4)];
  }, [displayData, zoomDomain]);

  // ── Drag-to-zoom: direct DOM, zero re-renders during drag ─────────────────
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selDivRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startPx: number } | null>(null);

  const pxToTimestamp = (px: number, plotWidth: number): number => {
    const t0 = zoomDomain?.[0] ?? displayData[0]?.time ?? 0;
    const t1 = zoomDomain?.[1] ?? displayData[displayData.length - 1]?.time ?? 0;
    return t0 + (px / plotWidth) * (t1 - t0);
  };

  const plotPx = (clientX: number): { px: number; plotWidth: number } | null => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const plotWidth = rect.width - YAXIS_WIDTH;
    const px = Math.max(0, Math.min(plotWidth, clientX - rect.left - YAXIS_WIDTH));
    return { px, plotWidth };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const p = plotPx(e.clientX);
    if (!p) return;
    dragRef.current = { startPx: p.px };
    if (selDivRef.current) {
      selDivRef.current.style.display = "none";
      selDivRef.current.style.left = `${p.px + YAXIS_WIDTH}px`;
      selDivRef.current.style.width = "0px";
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !selDivRef.current) return;
    const p = plotPx(e.clientX);
    if (!p) return;
    const left = Math.min(dragRef.current.startPx, p.px);
    const width = Math.abs(p.px - dragRef.current.startPx);
    selDivRef.current.style.left = `${left + YAXIS_WIDTH}px`;
    selDivRef.current.style.width = `${width}px`;
    selDivRef.current.style.display = width > 2 ? "block" : "none";
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const p = plotPx(e.clientX);
    const startPx = dragRef.current.startPx;
    dragRef.current = null;
    if (selDivRef.current) selDivRef.current.style.display = "none";
    if (!p || Math.abs(p.px - startPx) < 5) return;

    const t1 = pxToTimestamp(Math.min(startPx, p.px), p.plotWidth);
    const t2 = pxToTimestamp(Math.max(startPx, p.px), p.plotWidth);
    if (displayData.filter(d => d.time >= t1 && d.time <= t2).length >= 2) {
      setZoomDomain([t1, t2]);
    }
  };

  const onMouseLeave = () => {
    if (dragRef.current) {
      dragRef.current = null;
      if (selDivRef.current) selDivRef.current.style.display = "none";
    }
  };

  if (isPending) return (
    <div className="h-56 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-2">
      <img src="/favicon.ico" className="size-4 animate-spin" alt="" />
      <span className="text-sm text-slate-400">Chargement des données…</span>
    </div>
  );

  if (!displayData.length) return (
    <div className="h-56 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
      <span className="text-sm text-slate-400">Aucune donnée disponible</span>
    </div>
  );

  return (
    <div className="pt-3 pb-1 pr-4">
      <div className="flex items-center pl-11 mb-1 h-4">
        {unit && <p className="text-slate-400 text-[10px]">{unit}</p>}
        {zoomDomain && (
          <button
            onClick={() => setZoomDomain(null)}
            className="ml-auto text-[10px] text-sky-500 hover:text-sky-700 transition-colors"
          >
            ← Vue complète
          </button>
        )}
      </div>

      {/* wrapper capte les events souris pour la sélection, sans bloquer
          leur propagation vers le SVG Recharts (tooltip toujours actif) */}
      <div
        ref={wrapperRef}
        className="relative select-none"
        style={{ cursor: "crosshair" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <ResponsiveContainer key={serieId} width="100%" height={240}>
          <AreaChart
            data={displayData}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={`chartGrad-${serieId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.12} />
                <stop offset="90%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="time"
              scale="time"
              type="number"
              domain={xDomain}
              allowDataOverflow
              tickFormatter={(t: number) =>
                new Date(t).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
              }
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              width={YAXIS_WIDTH}
              tickFormatter={(v: number) => v.toFixed(2)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip unit={unit} paramLabel={paramLabel} />}
              cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#chartGrad-${serieId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Rectangle de sélection — pointer-events:none pour ne pas bloquer
            les events vers le SVG Recharts (tooltip reste fonctionnel) */}
        <div
          ref={selDivRef}
          className="absolute pointer-events-none hidden"
          style={{
            top: 4,
            bottom: 24,
            backgroundColor: `${color}22`,
            border: `1px solid ${color}66`,
          }}
        />
      </div>

      {!zoomDomain && (
        <p className="text-[9px] text-slate-300 pl-11 mt-0.5">
          Cliquer-glisser pour zoomer
        </p>
      )}
    </div>
  );
}
