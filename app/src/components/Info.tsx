import { ReactNode, useEffect, useRef, useState } from "react";

// Botón "?" que explica qué muestra cada objeto, de dónde sale el dato y cómo leerlo
export function Info({ children, titulo = "¿Qué estoy viendo?" }: { children: ReactNode; titulo?: string }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", cerrar); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  return (
    <div ref={ref} style={{ display: "contents" }}>
      <button className="info-btn" aria-expanded={abierto} aria-label={titulo} title={titulo}
        onClick={(e) => { e.stopPropagation(); setAbierto(!abierto); }}>?</button>
      {abierto && (
        <div className="info-pop" role="dialog" onClick={(e) => e.stopPropagation()}>
          <strong>{titulo}</strong>
          <div style={{ marginTop: 6 }}>{children}</div>
        </div>
      )}
    </div>
  );
}
