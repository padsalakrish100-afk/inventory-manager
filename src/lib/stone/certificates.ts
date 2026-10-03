// Grading labs and their public report-verification pages.
export const CERT_LABS = [
  { value: "GIA", label: "GIA" },
  { value: "IGI", label: "IGI" },
  { value: "HRD", label: "HRD" },
  { value: "OTHER", label: "Other" },
] as const;

export function verifyUrl(lab: string | null, certNumber: string | null): string | null {
  if (!lab || !certNumber) return null;
  const n = encodeURIComponent(certNumber.trim());
  switch (lab.toUpperCase()) {
    case "GIA":
      return `https://www.gia.edu/report-check?reportno=${n}`;
    case "IGI":
      return `https://www.igi.org/verify-your-report/?r=${n}`;
    case "HRD":
      return `https://my.hrdantwerp.com/?record_number=${n}`;
    default:
      return null;
  }
}
