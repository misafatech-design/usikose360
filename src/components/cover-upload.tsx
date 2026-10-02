import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function coverPublicUrl(path: string) {
  return `/api/public/covers/${path}`;
}

/** Works on any host: rewrites old app-relative cover links to direct storage links. */
export function resolveCover(url: string | null | undefined) {
  if (!url) return "";
  return url;
}

export function CoverUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("event-covers")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onChange(coverPublicUrl(path));
    toast.success("Photo uploaded");
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          <img src={resolveCover(value)} alt="Event thumbnail" className="aspect-[16/9] w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()}>
              Replace
            </Button>
            <Button type="button" size="icon" variant="secondary" onClick={() => onChange("")} aria-label="Remove photo">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          {busy ? "Uploading…" : "Click to upload a thumbnail (16:9, max 5 MB)"}
        </button>
      )}
    </div>
  );
}
