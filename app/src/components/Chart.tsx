import { useEffect, useRef } from "react";
import * as echarts from "echarts";

// Contenedor de ECharts: se redimensiona con su caja y se rehace al cambiar el tema
export function Chart({ option, className = "chart", label, onReady }: {
  option: echarts.EChartsCoreOption; className?: string; label: string;
  onReady?: (c: echarts.ECharts) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: "canvas" });
    inst.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    onReady?.(c);
    return () => { ro.disconnect(); c.dispose(); inst.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { inst.current?.setOption(option, true); }, [option]);

  return <div ref={ref} className={className} role="img" aria-label={label} />;
}

// Lee los tokens de color vigentes (cambian con el tema)
export function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    text: v("--text-primary"), text2: v("--text-secondary"), muted: v("--text-muted"),
    grid: v("--grid"), axis: v("--axis"), surface: v("--surface-1"), surface2: v("--surface-2"),
    accent: v("--accent"), sea: v("--sea"), hist: v("--hist"), critical: v("--critical"), font: v("--font"),
  };
}

export function tooltipBase(t: ReturnType<typeof tokens>) {
  return {
    backgroundColor: t.surface, borderColor: t.grid, borderWidth: 1, padding: [8, 10],
    textStyle: { color: t.text, fontFamily: t.font, fontSize: 12 },
    extraCssText: "border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);",
  };
}
