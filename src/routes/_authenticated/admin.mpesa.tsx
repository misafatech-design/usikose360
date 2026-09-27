import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { getMpesaSettings, saveMpesaSettings } from "@/lib/mpesa.functions";

export const Route = createFileRoute("/_authenticated/admin/mpesa")({
  head: () => ({
    meta: [
      { title: "M-Pesa settings — Usikose360 Admin" },
      { name: "description", content: "Configure M-Pesa Daraja payments and organizer payouts." },
      { property: "og:title", content: "M-Pesa settings — Usikose360 Admin" },
      { property: "og:description", content: "Daraja STK push and B2C payout configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminMpesa,
});

type Settings = Awaited<ReturnType<typeof getMpesaSettings>>[number];

function AdminMpesa() {
  const { isAdmin, loading } = useAuth();
  const fetchFn = useServerFn(getMpesaSettings);
  const q = useQuery({ queryKey: ["mpesa-settings"], queryFn: () => fetchFn(), enabled: isAdmin });

  return (
    <div className="">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">M-Pesa Daraja settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When an environment is switched on, ticket checkout sends real M-Pesa prompts and organizers can withdraw.
        </p>
        {!loading && !isAdmin ? (
          <div className="surface-panel mt-8 rounded-xl border border-border/70 p-8 text-center text-sm text-muted-foreground">
            Only system administrators can open this page.
          </div>
        ) : q.isLoading || !q.data ? (
          <Skeleton className="mt-8 h-96 rounded-xl" />
        ) : (
          <Tabs defaultValue={q.data.find((s) => s.is_active)?.environment ?? "sandbox"} className="mt-8">
            <TabsList>
              {q.data.map((s) => (
                <TabsTrigger key={s.environment} value={s.environment}>
                  {s.environment === "production" ? "Live" : "Sandbox"}
                  {s.is_active && <Badge className="ml-2 h-5">On</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
            {q.data.map((s) => (
              <TabsContent key={s.environment} value={s.environment}>
                <EnvForm s={s} onSaved={() => q.refetch()} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <code className="truncate rounded-md bg-secondary px-2 py-1.5 text-xs">{value}</code>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EnvForm({ s, onSaved }: { s: Settings; onSaved: () => void }) {
  const save = useServerFn(saveMpesaSettings);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    is_active: s.is_active,
    shortcode: s.shortcode,
    party_b: s.party_b,
    transaction_type: s.transaction_type as "CustomerPayBillOnline" | "CustomerBuyGoodsOnline",
    callback_base_url: s.callback_base_url,
    passkey: "",
    consumer_key: "",
    consumer_secret: "",
    b2c_shortcode: s.b2c_shortcode,
    b2c_initiator_name: s.b2c_initiator_name,
    b2c_command_id: s.b2c_command_id as "BusinessPayment" | "SalaryPayment" | "PromotionPayment",
    b2c_consumer_key: "",
    b2c_consumer_secret: "",
    b2c_initiator_password: "",
    b2c_certificate: "",
  });
  useEffect(() => {
    setF((p) => ({ ...p, is_active: s.is_active }));
  }, [s.is_active]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit() {
    setBusy(true);
    try {
      await save({ data: { environment: s.environment, ...f } });
      toast.success("Settings saved");
      setF((p) => ({
        ...p,
        passkey: "",
        consumer_key: "",
        consumer_secret: "",
        b2c_consumer_key: "",
        b2c_consumer_secret: "",
        b2c_initiator_password: "",
      }));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const env = s.environment === "production" ? "live" : "sandbox";

  return (
    <div className="space-y-6">
      <div className="surface-panel flex items-center justify-between gap-4 rounded-xl border border-border/70 p-5">
        <div className="min-w-0">
          <p className="font-semibold">Use {env} for payments</p>
          <p className="text-xs text-muted-foreground">Only one environment can be on at a time.</p>
        </div>
        <Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} />
      </div>

      <section className="surface-panel space-y-4 rounded-xl border border-border/70 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="h-4 w-4 text-primary-glow" /> Ticket payments (M-Pesa Express)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Account type</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={f.transaction_type}
              onChange={(e) => setF({ ...f, transaction_type: e.target.value as typeof f.transaction_type })}
            >
              <option value="CustomerPayBillOnline">Paybill</option>
              <option value="CustomerBuyGoodsOnline">Till (Buy Goods)</option>
            </select>
          </div>
          <Field id={`sc-${env}`} label="Business shortcode" value={f.shortcode} onChange={set("shortcode")} placeholder={s.environment === "sandbox" ? "174379" : ""} />
          {f.transaction_type === "CustomerBuyGoodsOnline" && (
            <Field id={`pb-${env}`} label="Till number (receiving)" value={f.party_b} onChange={set("party_b")} />
          )}
          <Field id={`pk-${env}`} label="Passkey" type="password" value={f.passkey} onChange={set("passkey")} placeholder={s.passkey_set || "Not set"} />
          <Field id={`ck-${env}`} label="Consumer key" type="password" value={f.consumer_key} onChange={set("consumer_key")} placeholder={s.consumer_key_set || "Not set"} />
          <Field id={`cs-${env}`} label="Consumer secret" type="password" value={f.consumer_secret} onChange={set("consumer_secret")} placeholder={s.consumer_secret_set || "Not set"} />
        </div>
        <Field
          id={`cb-${env}`}
          label="Public site address for M-Pesa callbacks"
          value={f.callback_base_url}
          onChange={set("callback_base_url")}
          placeholder="https://usikose360.lovable.app"
          hint="Leave empty to use this site's address. Must be public https."
        />
        <p className="text-xs text-muted-foreground">Saved secrets show only their last 4 characters. Leave blank to keep them.</p>
      </section>

      <section className="surface-panel space-y-4 rounded-xl border border-border/70 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wallet className="h-4 w-4 text-primary-glow" /> Organizer withdrawals (B2C)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`b2csc-${env}`} label="B2C shortcode" value={f.b2c_shortcode} onChange={set("b2c_shortcode")} placeholder={s.environment === "sandbox" ? "600000" : ""} />
          <Field id={`in-${env}`} label="Initiator name" value={f.b2c_initiator_name} onChange={set("b2c_initiator_name")} placeholder={s.environment === "sandbox" ? "testapi" : ""} />
          <div className="space-y-1.5">
            <Label>Payment type</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={f.b2c_command_id}
              onChange={(e) => setF({ ...f, b2c_command_id: e.target.value as typeof f.b2c_command_id })}
            >
              <option value="BusinessPayment">Business payment</option>
              <option value="SalaryPayment">Salary payment</option>
              <option value="PromotionPayment">Promotion payment</option>
            </select>
          </div>
          <Field id={`b2cck-${env}`} label="B2C consumer key (optional)" type="password" value={f.b2c_consumer_key} onChange={set("b2c_consumer_key")} placeholder={s.b2c_consumer_key_set || "Uses main key"} />
          <Field id={`b2ccs-${env}`} label="B2C consumer secret (optional)" type="password" value={f.b2c_consumer_secret} onChange={set("b2c_consumer_secret")} placeholder={s.b2c_consumer_secret_set || "Uses main secret"} />
        </div>

        <div className="rounded-lg border border-border/70 bg-secondary/30 p-4 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary-glow" /> Security credential
            {s.b2c_credential_set && <Badge variant="secondary">Generated</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">
            As Daraja recommends, enter the initiator password and paste the M-Pesa public certificate
            ({s.environment === "sandbox" ? "SandboxCertificate.cer" : "ProductionCertificate.cer"} from the Daraja portal).
            The password is encrypted with the certificate on the server and only the resulting credential is stored.
          </p>
          <Field id={`ip-${env}`} label="Initiator password" type="password" value={f.b2c_initiator_password} onChange={set("b2c_initiator_password")} />
          <div className="space-y-1.5">
            <Label htmlFor={`cert-${env}`}>Public certificate</Label>
            <Textarea
              id={`cert-${env}`}
              rows={5}
              className="font-mono text-xs"
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              value={f.b2c_certificate}
              onChange={set("b2c_certificate")}
            />
          </div>
        </div>
      </section>

      {(s.stk_callback || s.b2c_result) && (
        <section className="surface-panel space-y-3 rounded-xl border border-border/70 p-5">
          <h2 className="text-sm font-semibold">Callback addresses (sent automatically)</h2>
          <CopyRow label="Payment confirmation" value={s.stk_callback} />
          <CopyRow label="Payout result" value={s.b2c_result} />
        </section>
      )}

      <Button className="w-full" onClick={submit} disabled={busy}>
        {busy ? "Saving…" : `Save ${env} settings`}
      </Button>
    </div>
  );
}
