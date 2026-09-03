import type { Applicant, IdentityDocument } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const COUNTRY_NAMES: Record<string, string> = {
  US: "UNITED STATES OF AMERICA",
  NG: "FEDERAL REPUBLIC OF NIGERIA",
  RU: "RUSSIAN FEDERATION",
  CN: "PEOPLE'S REPUBLIC OF CHINA",
  BG: "REPUBLIC OF BULGARIA",
  GH: "REPUBLIC OF GHANA",
};

const ALPHA3: Record<string, string> = {
  US: "USA",
  NG: "NGA",
  RU: "RUS",
  CN: "CHN",
  BG: "BGR",
  GH: "GHA",
};

const US_STATE_NAMES: Record<string, string> = {
  IL: "Illinois",
  CA: "California",
  TX: "Texas",
  NY: "New York",
  GA: "Georgia",
  NV: "Nevada",
  MI: "Michigan",
  ME: "Maine",
  WA: "Washington",
  FL: "Florida",
  NJ: "New Jersey",
  OR: "Oregon",
};

function mrzPad(s: string, len: number) {
  return s.toUpperCase().replace(/[^A-Z0-9<]/g, "<").padEnd(len, "<").slice(0, len);
}

function mrzDate(iso: string) {
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}

function checkDigit(input: string) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const v = c === "<" ? 0 : c >= "0" && c <= "9" ? Number(c) : c.charCodeAt(0) - 55;
    sum += v * weights[i % 3];
  }
  return String(sum % 10);
}

function buildMrz(doc: IdentityDocument, applicant: Applicant) {
  const [first, ...rest] = applicant.legalName.split(" ");
  const surname = rest.join("<") || first;
  const given = rest.length ? first : "";
  const alpha3 = ALPHA3[doc.issuingCountry] ?? "XXX";
  const line1 = mrzPad(`P<${alpha3}${surname}<<${given}`, 44);
  const num = mrzPad(doc.documentNumber.replace(/\s/g, ""), 9);
  const dob = mrzDate(applicant.dateOfBirth);
  const exp = mrzDate(doc.expiresOn);
  const nat = ALPHA3[applicant.nationality] ?? alpha3;
  const body = `${num}${checkDigit(num)}${nat}${dob}${checkDigit(dob)}M${exp}${checkDigit(exp)}${"<".repeat(14)}0`;
  return [line1, mrzPad(body + checkDigit(body), 44)];
}

function PhotoPlaceholder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 100" className={cn("h-full w-full", className)} aria-hidden>
      <defs>
        <linearGradient id="ph-bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e4e4e7" />
          <stop offset="1" stopColor="#d4d4d8" />
        </linearGradient>
      </defs>
      <rect width="80" height="100" fill="url(#ph-bg)" />
      <circle cx="40" cy="38" r="16" fill="#a1a1aa" />
      <path d="M12 100c0-20 12-32 28-32s28 12 28 32z" fill="#a1a1aa" />
      <g stroke="#f4f4f5" strokeWidth="0.75" opacity="0.5">
        <line x1="0" y1="20" x2="80" y2="20" />
        <line x1="0" y1="50" x2="80" y2="50" />
        <line x1="0" y1="80" x2="80" y2="80" />
      </g>
    </svg>
  );
}

function Field({ label, value, mono = true, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <span className="text-[6.5px] font-semibold tracking-wider text-zinc-500 uppercase">{label}</span>
      <span className={cn("mt-[2px] text-[9.5px] font-semibold text-zinc-900", mono && "font-mono tracking-tight")}>{value}</span>
    </div>
  );
}

function Signature({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 120 24" className="h-4 w-24" aria-label={`Signature of ${name}`}>
      <path
        d="M4 16c8-10 12-12 14-8s-4 12 2 10 10-14 16-12-2 14 4 12 12-16 18-10 0 16 8 10 10-12 16-8 2 10 8 6 8-8 14-6 8 6 12 2"
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Barcode() {
  const bars = Array.from({ length: 64 }, (_, i) => ((i * 7919) % 5) + 1);
  return (
    <svg viewBox="0 0 200 18" className="h-[14px] w-full" preserveAspectRatio="none" aria-hidden>
      {bars.map((w, i) => (
        <rect key={i} x={i * 3.1} y={0} width={w * 0.45} height={18} fill="#27272a" />
      ))}
    </svg>
  );
}

export function IdentityCard({ document: doc, applicant }: { document: IdentityDocument; applicant: Applicant }) {
  const expired = new Date(doc.expiresOn).getTime() < Date.now();
  const [first, ...rest] = applicant.legalName.split(" ");
  const last = rest.join(" ") || first;

  if (doc.type === "PASSPORT") {
    const [mrz1, mrz2] = buildMrz(doc, applicant);
    return (
      <div
        className="relative w-[360px] overflow-hidden rounded-md border border-zinc-300 bg-[#f4efe4] text-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
        data-testid="identity-card"
      >
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(135deg, #7c6a4a 0 1px, transparent 1px 8px)" }} />
        <div className="relative px-4 pt-3 pb-2">
          <div className="flex items-start justify-between">
            <div className="leading-none">
              <div className="text-[7px] font-semibold tracking-[0.2em] text-[#5b4a2c]">{COUNTRY_NAMES[doc.issuingCountry] ?? doc.issuingCountry}</div>
              <div className="mt-1 text-[13px] font-bold tracking-[0.25em] text-[#3b2e17]">PASSPORT</div>
            </div>
            <div className="text-right leading-none">
              <span className="text-[6.5px] font-semibold tracking-wider text-zinc-500 uppercase">Type / Code</span>
              <div className="mt-[2px] font-mono text-[9.5px] font-semibold">P / {ALPHA3[doc.issuingCountry] ?? "XXX"}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <div className="h-[92px] w-[72px] shrink-0 overflow-hidden rounded-[2px] border border-zinc-400/60">
              <PhotoPlaceholder />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2">
              <Field label="Surname" value={last.toUpperCase()} mono={false} />
              <Field label="Passport No." value={doc.documentNumber} />
              <Field label="Given names" value={first.toUpperCase()} mono={false} />
              <Field label="Nationality" value={ALPHA3[applicant.nationality] ?? applicant.nationality} />
              <Field label="Date of birth" value={formatDate(applicant.dateOfBirth)} />
              <Field label="Date of issue" value={formatDate(doc.issuedOn)} />
              <Field label="Sex" value="M" />
              <Field label="Date of expiry" value={formatDate(doc.expiresOn)} className={expired ? "text-red-700" : undefined} />
              <Field label="Authority" value={doc.issuingAuthority} mono={false} className="col-span-2" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Signature name={applicant.legalName} />
            <span className="text-[6.5px] tracking-wider text-zinc-500 uppercase">Holder&apos;s signature</span>
          </div>
        </div>
        <div className="relative border-t border-dashed border-zinc-400/60 bg-white/70 px-4 py-2 font-mono text-[10.5px] leading-[1.35] tracking-[0.12em] text-zinc-900">
          <div>{mrz1}</div>
          <div>{mrz2}</div>
        </div>
        {expired && <ExpiredStamp />}
      </div>
    );
  }

  const region = applicant.address.region;
  return (
    <div
      className="relative w-[360px] overflow-hidden rounded-md border border-zinc-300 bg-white text-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
      data-testid="identity-card"
    >
      <div className="flex items-center justify-between bg-[#1e3a5f] px-3 py-1.5 text-white">
        <div className="leading-none">
          <div className="text-[9px] font-bold tracking-[0.15em] uppercase">{US_STATE_NAMES[region] ?? region}</div>
          <div className="mt-[3px] text-[6.5px] font-medium tracking-[0.2em] text-sky-200 uppercase">Driver License</div>
        </div>
        <div className="text-right leading-none">
          <div className="text-[6.5px] tracking-wider text-sky-200 uppercase">USA</div>
          <div className="mt-[3px] font-mono text-[8px] font-semibold">CLASS C</div>
        </div>
      </div>
      <div className="relative px-3 pt-2.5 pb-2">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(#1e3a5f 0.6px, transparent 0.6px)", backgroundSize: "6px 6px" }} />
        <div className="relative flex gap-3">
          <div className="flex w-[72px] shrink-0 flex-col gap-1.5">
            <div className="h-[92px] w-[72px] overflow-hidden rounded-[2px] border border-zinc-300">
              <PhotoPlaceholder />
            </div>
            <Signature name={applicant.legalName} />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-[7px]">
            <Field label="DL No." value={doc.documentNumber} className="col-span-2 text-[#1e3a5f]" />
            <Field label="1 Family name" value={last.toUpperCase()} mono={false} />
            <Field label="2 Given name" value={first.toUpperCase()} mono={false} />
            <Field label="3 DOB" value={formatDate(applicant.dateOfBirth)} />
            <Field label="4b Exp" value={formatDate(doc.expiresOn)} className={expired ? "text-red-700" : undefined} />
            <Field
              label="8 Address"
              value={`${doc.ocr.addressLine ?? `${applicant.address.line1}, ${applicant.address.city}, ${region} ${applicant.address.postalCode}`}`}
              mono={false}
              className="col-span-2"
            />
            <Field label="4a Iss" value={formatDate(doc.issuedOn)} />
            <Field label="15 Sex / 18 Eyes" value="M / BRO" />
          </div>
        </div>
        <div className="relative mt-2 flex items-center gap-2">
          <Barcode />
        </div>
      </div>
      {expired && <ExpiredStamp />}
    </div>
  );
}

function ExpiredStamp() {
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-2 border-red-600/70 px-2 py-0.5 font-mono text-sm font-bold tracking-[0.2em] text-red-600/70 uppercase">
      Expired
    </div>
  );
}
