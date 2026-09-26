import logo from "@/assets/usikose-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <img
        src={logo.url}
        alt="Usikose360"
        width={36}
        height={36}
        className="h-9 w-9 rounded-lg object-contain"
      />
      {showWord && (
        <span className="font-display text-lg font-bold tracking-tight">
          Usikose<span className="text-gradient-brand">360</span>
        </span>
      )}
    </span>
  );
}
