import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

// Contenedor de ECharts: se redimensiona con su caja y se rehace al cambiar el tema.
// Con `diferido`, el gráfico se dibuja (y se anima) recién cuando entra en pantalla.
export function Chart({ option, className = "chart", label, onReady, diferido = false }: {
  option: echarts.EChartsCoreOption; className?: string; label: string;
  onReady?: (c: echarts.ECharts) => void; diferido?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const [visible, setVisible] = useState(!diferido);

  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

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

  useEffect(() => { if (visible) inst.current?.setOption(option, true); }, [option, visible]);

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
