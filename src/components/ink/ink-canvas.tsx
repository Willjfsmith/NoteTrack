"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { Eraser, Hand, Pen, Redo2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type InkStroke = { points: Array<[number, number, number]>; color: string; size: number };
export type InkData = { width: number; height: number; strokes: InkStroke[] };

const COLORS = [
  { key: "ink", value: "#161616" },
  { key: "accent", value: "#2456d6" },
  { key: "red", value: "#9a2323" },
];

function strokePath(points: Array<[number, number, number]>, size: number): Path2D | null {
  const outline = getStroke(points, {
    size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: points.every((p) => p[2] === 0.5),
  });
  if (outline.length < 2) return null;
  const path = new Path2D();
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) path.lineTo(outline[i][0], outline[i][1]);
  path.closePath();
  return path;
}

export function renderInk(ctx: CanvasRenderingContext2D, data: InkData, scale = 1) {
  ctx.save();
  ctx.scale(scale, scale);
  for (const s of data.strokes) {
    const p = strokePath(s.points, s.size);
    if (!p) continue;
    ctx.fillStyle = s.color;
    ctx.fill(p);
  }
  ctx.restore();
}

/**
 * A write-once sketch surface. Pen (Apple Pencil) and mouse draw; finger touches are ignored
 * unless "finger" is switched on, which gives palm rejection for free. Strokes are kept as
 * vectors with pressure and rendered through perfect-freehand.
 */
export function InkCanvas({
  onSave,
  onClose,
  title = "Sketch",
}: {
  onSave: (png: Blob, data: InkData) => Promise<void> | void;
  onClose: () => void;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [redo, setRedo] = useState<InkStroke[]>([]);
  const current = useRef<InkStroke | null>(null);
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(4);
  const [eraser, setEraser] = useState(false);
  const [finger, setFinger] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  // size the canvas to its container, device-pixel aware
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDims({ w: Math.max(200, Math.floor(r.width)), h: Math.max(200, Math.floor(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    const all = current.current ? [...strokes, current.current] : strokes;
    renderInk(ctx, { width: dims.w, height: dims.h, strokes: all }, dpr);
  }, [strokes, dims]);

  useEffect(() => {
    draw();
  }, [draw]);

  function accepts(e: React.PointerEvent) {
    if (e.pointerType === "touch") return finger;
    return true; // pen, mouse
  }

  function pt(e: PointerEvent | React.PointerEvent): [number, number, number] {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const pressure = e.pointerType === "pen" ? Math.max(0.05, e.pressure) : 0.5;
    return [e.clientX - r.left, e.clientY - r.top, pressure];
  }

  function hitStroke(x: number, y: number): number {
    // nearest stroke within a few px of any point
    const tol = 8;
    for (let i = strokes.length - 1; i >= 0; i--) {
      for (const p of strokes[i].points) {
        if (Math.abs(p[0] - x) < tol && Math.abs(p[1] - y) < tol) return i;
      }
    }
    return -1;
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!accepts(e)) return;
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = pt(e);
    if (eraser) {
      const i = hitStroke(p[0], p[1]);
      if (i >= 0) {
        setRedo([]);
        setStrokes((s) => s.filter((_, j) => j !== i));
      }
      return;
    }
    current.current = { points: [p], color, size };
    draw();
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!current.current || !accepts(e)) return;
    e.preventDefault();
    const native = e.nativeEvent as PointerEvent;
    const events = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [native];
    for (const ev of events.length ? events : [native]) current.current.points.push(pt(ev));
    draw();
  }
  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return;
    e.preventDefault();
    const s = current.current;
    current.current = null;
    if (s.points.length > 0) {
      setRedo([]);
      setStrokes((prev) => [...prev, s]);
    }
  }

  function undo() {
    setStrokes((s) => {
      if (s.length === 0) return s;
      setRedo((r) => [...r, s[s.length - 1]]);
      return s.slice(0, -1);
    });
  }
  function redoOne() {
    setRedo((r) => {
      if (r.length === 0) return r;
      setStrokes((s) => [...s, r[r.length - 1]]);
      return r.slice(0, -1);
    });
  }

  async function save() {
    const c = canvasRef.current;
    if (!c || strokes.length === 0) return;
    setSaving(true);
    try {
      // trim to the drawn bounds (with padding) so thumbnails are not mostly whitespace
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of strokes) for (const p of s.points) {
        minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
      }
      const pad = 24;
      const x0 = Math.max(0, Math.floor(minX - pad));
      const y0 = Math.max(0, Math.floor(minY - pad));
      const w = Math.min(dims.w, Math.ceil(maxX + pad)) - x0;
      const h = Math.min(dims.h, Math.ceil(maxY + pad)) - y0;
      const shifted: InkStroke[] = strokes.map((s) => ({
        ...s,
        points: s.points.map(([x, y, p]) => [x - x0, y - y0, p] as [number, number, number]),
      }));
      const data: InkData = { width: w, height: h, strokes: shifted };
      const off = document.createElement("canvas");
      const scale = 2;
      off.width = w * scale;
      off.height = h * scale;
      const ctx = off.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, off.width, off.height);
      renderInk(ctx, data, scale);
      const blob = await new Promise<Blob | null>((res) => off.toBlob(res, "image/png"));
      if (!blob) throw new Error("Could not render sketch.");
      await onSave(blob, data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface px-2 py-1.5">
        <span className="mr-2 text-[12.5px] font-medium">{title}</span>
        {COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setColor(c.value); setEraser(false); }}
            aria-label={c.key}
            className={cn("h-6 w-6 rounded-full border-2", color === c.value && !eraser ? "border-ink" : "border-transparent")}
            style={{ background: c.value }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {[2, 4, 7].map((s) => (
          <button
            key={s}
            onClick={() => { setSize(s); setEraser(false); }}
            aria-label={`size ${s}`}
            className={cn("grid h-6 w-6 place-items-center rounded-2 border", size === s && !eraser ? "border-ink bg-bg-2" : "border-transparent hover:bg-bg-2")}
          >
            <span className="rounded-full bg-ink" style={{ width: s + 2, height: s + 2 }} />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <Button size="sm" variant={eraser ? "primary" : "ghost"} onClick={() => setEraser((e) => !e)} title="Eraser (removes a whole stroke)">
          <Eraser className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant={finger ? "primary" : "ghost"} onClick={() => setFinger((f) => !f)} title="Allow finger drawing (off = palm rejection)">
          {finger ? <Hand className="h-3.5 w-3.5" /> : <Pen className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{finger ? "finger" : "pen only"}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={undo} disabled={strokes.length === 0} title="Undo">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={redoOne} disabled={redo.length === 0} title="Redo">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onClose} disabled={saving}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" variant="accent" onClick={save} disabled={saving || strokes.length === 0}>
          {saving ? "Saving…" : "Save sketch"}
        </Button>
      </div>
      <div ref={wrapRef} className="ink-surface relative flex-1 bg-surface">
        <canvas
          ref={canvasRef}
          width={dims.w * (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)}
          height={dims.h * (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)}
          style={{ width: dims.w, height: dims.h, touchAction: "none" }}
          className="ink-surface absolute inset-0 cursor-crosshair"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        />
        {strokes.length === 0 && !current.current && (
          <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12.5px] text-ink-4">
            Draw with the Pencil. Saved once; not editable later.
          </p>
        )}
      </div>
    </div>
  );
}
