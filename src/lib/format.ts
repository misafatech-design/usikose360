export function formatKes(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!n) return "Free";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizeMpesaPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export function isValidMpesaPhone(input: string) {
  return /^254(7|1)\d{8}$/.test(normalizeMpesaPhone(input));
}
