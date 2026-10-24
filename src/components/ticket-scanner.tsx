import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Lock, Search, Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cleanCode, type AdmitResult } from "@/lib/admission";

const RESULT_TEXT: Record<AdmitResult["result"], string> = {
  admitted: "Admitted — marked attended",
  already: "Already admitted",
  invalid: "Invalid ticket",
  undone: "Admission undone",
  locked: "Ticket is listed for resale",
  expired: "Your gate session ended",
};

/** Camera + manual ticket scanner shared by staff accounts and gate passes. */
export function TicketScanner({
  title,
  subtitle,
  admitted,
  total,
  onCheck,
  footer,
}: {
  title: string;
  subtitle?: string | undefined;
  admitted: number;
  total: number;
  onCheck: (code: string, undo: boolean) => Promise<AdmitResult>;
  footer?: React.ReactNode;
}) {
  const [code, setCode] = useState("");
  const [last, setLast] = useState<AdmitResult | null>(null);
  const [history, setHistory] = useState<(AdmitResult & { t: number })[]>([]);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const checkRef = useRef<(raw: string, undo?: boolean) => Promise<void>>(async () => {});

  async function check(raw: string, undo = false) {
    const c = cleanCode(raw);
    if (!c || busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await onCheck(c, undo);
      setLast(r);
      setHistory((h) => [{ ...r, t: Date.now() }, ...h].slice(0, 8));
      setCode("");
      if (navigator.vibrate) navigator.vibrate(r.result === "admitted" ? 80 : [60, 60, 60]);
    } catch (e) {
      setLast({ result: "invalid", code: c, name: (e as Error).message });
    } finally {
      busyRef.current = false;
    }
  }
  checkRef.current = check;

  useEffect(() => {
    if (!camOn) return;
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setCamOn(false);
      setCamError("This browser can't scan with the camera. Type the ticket code below, or use Chrome on Android.");
      return;
    }
    setCamError(null);
    const detector = new Detector({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const v = codes[0]?.rawValue as string | undefined;
            const now = Date.now();
            if (v && (v !== lastCodeRef.current.code || now - lastCodeRef.current.at > 4000)) {
              lastCodeRef.current = { code: v, at: now };
              await checkRef.current(v);
            }
          } catch {
            /* ignore frame */
          }
          timer = window.setTimeout(scan, 300);
        };
        scan();
      } catch {
        setCamOn(false);
        setCamError("Camera permission was blocked. Allow camera access in your browser settings.");
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camOn]);

  const tone =
    last?.result === "admitted" || last?.result === "undone"
      ? "border-success/60 bg-success/10"
      : last?.result === "already" || last?.result === "locked"
        ? "border-warning/60 bg-warning/10"
        : "border-destructive/60 bg-destructive/10";
  const pct = total ? Math.round((admitted / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="truncate text-2xl font-extrabold">{title}</h1>
      {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground">Admitted</p>
          <p className="text-2xl font-bold tabular-nums">
            {admitted}
            <span className="text-base font-medium text-muted-foreground"> / {total}</span>
          </p>
        </div>
        <Progress value={pct} className="mt-2 h-2" />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {camOn ? (
          <div className="relative">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-primary/80" />
          </div>
        ) : (
          <div className="flex aspect-[2/1] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
            <Camera className="h-8 w-8 opacity-50" />
            {camError ?? "Camera off"}
          </div>
        )}
      </div>
      <Button className="mt-3 w-full" size="lg" variant={camOn ? "secondary" : "default"} onClick={() => setCamOn(!camOn)}>
        {camOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {camOn ? "Stop scanning" : "Scan QR code"}
      </Button>

      <form
        className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          check(code);
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Or type ticket code"
          className="font-mono tracking-widest"
          autoCapitalize="characters"
          aria-label="Ticket code"
        />
        <Button type="submit" variant="secondary" aria-label="Check code">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {last && (
        <div className={`mt-6 rounded-2xl border p-5 ${tone}`} role="status">
          <div className="flex items-center gap-3">
            {last.result === "admitted" || last.result === "undone" ? (
              <CheckCircle2 className="h-9 w-9 shrink-0 text-success" />
            ) : last.result === "already" ? (
              <AlertTriangle className="h-9 w-9 shrink-0 text-warning" />
            ) : last.result === "locked" ? (
              <Lock className="h-9 w-9 shrink-0 text-warning" />
            ) : (
              <XCircle className="h-9 w-9 shrink-0 text-destructive" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-bold">{RESULT_TEXT[last.result]}</p>
              {last.name && <p className="truncate text-sm font-medium">{last.name}</p>}
              <p className="truncate font-mono text-xs text-muted-foreground">
                {last.code}
                {last.type ? ` · ${last.type}` : ""}
                {last.at ? ` · ${new Date(last.at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </p>
              {last.by && <p className="truncate text-xs text-muted-foreground">Admitted by {last.by}</p>}
            </div>
          </div>
          {(last.result === "admitted" || last.result === "already") && last.code && (
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => check(last.code!, true)}>
              <Undo2 className="h-4 w-4" /> Undo admission
            </Button>
          )}
        </div>
      )}

      {history.length > 1 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent scans</p>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
            {history.slice(1).map((h) => (
              <li key={h.t} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="truncate font-mono">{h.code}</span>
                <span className="shrink-0 text-muted-foreground">{RESULT_TEXT[h.result]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {footer}
    </div>
  );
}
