/**
 * Minimal SMTP client over raw TCP sockets (cloudflare:sockets) for edge runtimes,
 * where Nodemailer's Node `net`/`tls` emulation fails ("proxy request failed").
 * Supports implicit SSL (465), STARTTLS (587) and plain, with AUTH LOGIN/PLAIN.
 */
type Sock = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  startTls: () => Sock;
  close: () => Promise<void>;
};

export type SocketMailOpts = {
  host: string;
  port: number;
  security: "ssl" | "starttls" | "none";
  username?: string | null;
  password?: string | null;
  from: { name: string; address: string };
  replyTo?: string | undefined;
  to: string;
  subject: string;
  html: string;
  text: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(s: string) {
  const bytes = enc.encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
const wrap = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

class Conn {
  private reader!: ReadableStreamDefaultReader<Uint8Array>;
  private writer!: WritableStreamDefaultWriter<Uint8Array>;
  private buf = "";
  constructor(public sock: Sock) {
    this.attach(sock);
  }
  attach(sock: Sock) {
    this.sock = sock;
    this.reader = sock.readable.getReader();
    this.writer = sock.writable.getWriter();
    this.buf = "";
  }
  release() {
    this.reader.releaseLock();
    this.writer.releaseLock();
  }
  async write(line: string) {
    await this.writer.write(enc.encode(line));
  }
  async read(): Promise<{ code: number; text: string }> {
    const lines: string[] = [];
    const deadline = Date.now() + 25_000;
    for (;;) {
      let i: number;
      while ((i = this.buf.indexOf("\r\n")) >= 0) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        lines.push(line);
        if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
          return { code: parseInt(line.slice(0, 3), 10), text: lines.join("\n") };
        }
      }
      if (Date.now() > deadline) throw new Error("SMTP timeout waiting for server response");
      const { value, done } = await this.reader.read();
      if (done) throw new Error("SMTP connection closed by server");
      this.buf += dec.decode(value, { stream: true });
    }
  }
  async cmd(line: string, expect: number[]) {
    await this.write(line + "\r\n");
    const r = await this.read();
    if (!expect.includes(r.code)) {
      const shown = line.startsWith("AUTH") || /^[A-Za-z0-9+/=]+$/.test(line) ? "AUTH" : line.split(" ")[0];
      throw new Error(`SMTP ${shown} failed: ${r.text}`);
    }
    return r;
  }
}

function buildMessage(o: SocketMailOpts) {
  const boundary = "b_" + crypto.randomUUID().replace(/-/g, "");
  const domain = o.from.address.split("@")[1] || o.host;
  const headers = [
    `From: ${encWord(o.from.name)} <${o.from.address}>`,
    `To: <${o.to}>`,
    o.replyTo ? `Reply-To: <${o.replyTo}>` : "",
    `Subject: ${encWord(o.subject)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(o.text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(o.html)),
    `--${boundary}--`,
    "",
  ];
  return headers.join("\r\n") + "\r\n\r\n" + body.join("\r\n");
}

export async function sendViaSocket(o: SocketMailOpts) {
  const modName = "cloudflare:sockets";
  const { connect } = (await import(/* @vite-ignore */ modName)) as {
    connect: (a: { hostname: string; port: number }, o: { secureTransport: string; allowHalfOpen: boolean }) => Sock;
  };
  const sock = connect(
    { hostname: o.host, port: o.port },
    { secureTransport: o.security === "ssl" ? "on" : o.security === "starttls" ? "starttls" : "off", allowHalfOpen: false },
  );
  const c = new Conn(sock);
  try {
    const greet = await c.read();
    if (greet.code !== 220) throw new Error(`SMTP greeting failed: ${greet.text}`);
    const helo = "usikose360";
    let ehlo = await c.cmd(`EHLO ${helo}`, [250]);
    if (o.security === "starttls") {
      await c.cmd("STARTTLS", [220]);
      c.release();
      c.attach(c.sock.startTls());
      ehlo = await c.cmd(`EHLO ${helo}`, [250]);
    }
    if (o.username) {
      const caps = ehlo.text.toUpperCase();
      if (caps.includes("PLAIN") && !caps.includes("LOGIN")) {
        await c.cmd(`AUTH PLAIN ${b64(`\0${o.username}\0${o.password ?? ""}`)}`, [235]);
      } else {
        await c.cmd("AUTH LOGIN", [334]);
        await c.cmd(b64(o.username), [334]);
        await c.cmd(b64(o.password ?? ""), [235]);
      }
    }
    await c.cmd(`MAIL FROM:<${o.from.address}>`, [250]);
    await c.cmd(`RCPT TO:<${o.to}>`, [250, 251]);
    await c.cmd("DATA", [354]);
    const data = buildMessage(o).replace(/\r\n\./g, "\r\n..");
    await c.cmd(data + "\r\n.", [250]);
    await c.write("QUIT\r\n").catch(() => {});
  } finally {
    try {
      await c.sock.close();
    } catch {
      /* ignore */
    }
  }
}
