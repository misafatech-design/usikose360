import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, AlertTriangle, XCircle, Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { admitTicket } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/admit/$eventId")({
  head: () => ({
    meta: [
      { title: "Scan tickets — Usikose360" },
      { name: "description", content: "Scan QR tickets and admit guests at the gate." },
      { property: "og:title", content: "Scan tickets — Usikose360" },
      { property: "og:description", content: "Gate admission scanner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admit,
});

type Result = Awaited<ReturnType<typeof admitTicket>>;

function Admit() {
  const { eventId } = Route.useParams();
  const admit = useServerFn(admitTicket);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<Result | null>(null);
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const event = useQuery({
    queryKey: ["admit-event", eventId],
    queryFn: async () => (await supabase.from("events").select("title").eq("id", eventId).single()).data,
  });
  const stats = useQuery({
    queryKey: ["admit-stats", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("checked_in_at").eq("event_id", eventId);
      const all = data ?? [];
      return { total: all.length, in: all.filter((t) => t.checked_in_at).length };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admit-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `event_id=eq.${eventId}` }, () =>
        stats.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [eventId, stats]);

  async function check(raw: string, undo = false) {
    const c = raw.trim().replace(/^USIKOSE:/i, "");
    if (!c || busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await admit({ data: { eventId, code: c, undo } });
      setLast(r);
      setCode("");
      if (navigator.vibrate) navigator.vibrate(r.result === "admitted" ? 80 : [60, 60, 60]);
      stats.refetch();
    } catch (e) {
      setLast({ result: "invalid", code: c } as Result);
    } finally {
      busyRef.current = false;
    }
  }

  // Camera QR scanning via the browser's built-in barcode detector
  useEffect(() => {
    if (!camOn) return;
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setCamOn(false);
      alert("This browser can't scan with the camera. Type the ticket code instead.");
      return;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let raf = 0;
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
              await check(v);
            }
          } catch {
            /* ignore frame */
          }
          raf = window.setTimeout(scan, 350) as unknown as number;
        };
        scan();
      } catch {
        setCamOn(false);
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOn]);

  const tone =
    last?.result === "admitted"
      ? "border-primary/60 bg-primary/10"
      : last?.result === "already"
        ? "border-warning/60 bg-warning/10"
        : "border-destructive/60 bg-destructive/10";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="truncate text-2xl font-extrabold">{event.data?.title ?? "Admissions"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admitted {stats.data?.in ?? 0} of {stats.data?.total ?? 0} tickets
        </p>

        <div className="surface-panel mt-6 overflow-hidden rounded-2xl border border-border/70">
          {camOn ? (
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          ) : (
            <div className="flex aspect-[2/1] items-center justify-center text-sm text-muted-foreground">
              Camera off
            </div>
          )}
        </div>
        <Button className="mt-3 w-full" variant={camOn ? "secondary" : "default"} onClick={() => setCamOn(!camOn)}>
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
          />
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {last && (
          <div className={`mt-6 rounded-2xl border p-5 ${tone}`}>
            <div className="flex items-center gap-3">
              {last.result === "admitted" || last.result === "undone" ? (
                <CheckCircle2 className="h-8 w-8 shrink-0 text-primary-glow" />
              ) : last.result === "already" ? (
                <AlertTriangle className="h-8 w-8 shrink-0 text-warning" />
              ) : (
                <XCircle className="h-8 w-8 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <p className="text-lg font-bold">
                  {last.result === "admitted" && "Admitted — marked attended"}
                  {last.result === "already" && "Already admitted"}
                  {last.result === "invalid" && "Invalid ticket"}
                  {last.result === "undone" && "Admission undone"}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {last.code}
                  {"type" in last && last.type ? ` · ${last.type}` : ""}
                  {"at" in last && last.at ? ` · ${new Date(last.at).toLocaleTimeString("en-KE")}` : ""}
                </p>
              </div>
            </div>
            {(last.result === "admitted" || last.result === "already") && (
              <Button size="sm" variant="ghost" className="mt-3" onClick={() => check(last.code, true)}>
                Undo admission
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
