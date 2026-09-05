import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

const esc = (v: any) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function riskHex(level: string) {
  switch ((level || "").toLowerCase()) {
    case "low":
      return "#16A34A";
    case "medium":
      return "#F59E0B";
    case "high":
      return "#DC2626";
    case "critical":
      return "#7F1D1D";
    default:
      return "#71717A";
  }
}

const MODE_NAMES: Record<string, string> = {
  risk: "Live Risk Assessment",
  swms: "Safe Work Method Statement (SWMS)",
  density: "Worker Density Assessment",
  machinery: "Machinery Safety Assessment",
};

export function buildHtml(a: any): string {
  const r = a.result || {};
  const created = new Date(a.created_at).toLocaleString("en-AU");
  const modeName = MODE_NAMES[a.mode] || "Safety Assessment";

  const hazards = (r.hazards || [])
    .map(
      (h: any) => `
      <tr>
        <td>${esc(h.hazard)}</td>
        <td style="text-align:center"><span class="pill" style="background:${riskHex(h.risk_level)}">${esc(h.risk_level)}</span></td>
        <td>${esc(h.likelihood)}</td>
        <td>${esc(h.consequence)}</td>
        <td>${(h.controls || []).map((c: string) => `• ${esc(c)}`).join("<br/>")}</td>
      </tr>`
    )
    .join("");

  const swms =
    (r.swms_steps || []).length > 0
      ? `<h2>SWMS — Task Steps</h2>
        <table>
          <tr><th>Step</th><th>Hazards</th><th>Controls</th><th>PPE</th></tr>
          ${(r.swms_steps || [])
            .map(
              (s: any) => `<tr><td>${esc(s.step)}</td><td>${esc(s.hazards)}</td><td>${esc(s.controls)}</td><td>${esc(s.ppe)}</td></tr>`
            )
            .join("")}
        </table>`
      : "";

  const density = r.density
    ? `<h2>Worker Density</h2>
       <p><b>People counted:</b> ${esc(r.density.people_count)} &nbsp; | &nbsp;
       <b>Rating:</b> <span class="pill" style="background:${riskHex(r.density.density_rating)}">${esc(r.density.density_rating)}</span></p>
       <p><b>Area note:</b> ${esc(r.density.area_note)}</p>
       <p><b>Recommendation:</b> ${esc(r.density.recommendation)}</p>`
    : "";

  const machinery = r.machinery
    ? `<h2>Machinery Safety</h2>
       <p><b>Machine:</b> ${esc(r.machinery.machine_type)}</p>
       <p><b>Guarding:</b> ${esc(r.machinery.guarding_status)}</p>
       <p><b>Isolation / LOTO:</b> ${esc(r.machinery.isolation_note)}</p>
       <p><b>Compliance (AS 4024):</b> ${esc(r.machinery.compliance_note)}</p>`
    : "";

  const actions = (r.recommended_actions || []).map((x: string) => `<li>${esc(x)}</li>`).join("");
  const refs = (r.legislation_refs || []).map((x: string) => `<li>${esc(x)}</li>`).join("");

  const approved = a.status === "approved";
  const statusBanner = approved
    ? `<div class="status approved">APPROVED &amp; FINALISED — ${esc(a.approved_by)} (${esc(a.approved_by_role)}) · ${esc(new Date(a.approved_at).toLocaleString("en-AU"))}</div>`
    : `<div class="status draft">DRAFT — PENDING SAFETY OFFICER SIGN-OFF</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    * { font-family: -apple-system, Helvetica, Arial, sans-serif; }
    body { color:#111; padding:28px; }
    .brand { font-size:12px; letter-spacing:3px; color:#71717A; }
    h1 { font-size:24px; margin:4px 0 2px; }
    .sub { color:#52525B; font-size:13px; }
    .meta { border:2px solid #111; padding:12px; margin:16px 0; font-size:13px; }
    .overall { display:inline-block; color:#fff; padding:6px 14px; font-weight:bold; margin:10px 0; background:${riskHex(r.overall_risk_level)}; }
    .status { padding:8px 12px; margin:10px 0; font-size:12px; font-weight:bold; letter-spacing:1px; }
    .status.approved { background:#16A34A; color:#fff; }
    .status.draft { background:#F59E0B; color:#111; }
    h2 { font-size:16px; border-bottom:2px solid #111; padding-bottom:4px; margin-top:24px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; font-size:12px; }
    th,td { border:1px solid #999; padding:6px; text-align:left; vertical-align:top; }
    th { background:#111; color:#fff; }
    .pill { color:#fff; padding:2px 8px; font-size:11px; border-radius:2px; }
    ul { font-size:13px; }
    .foot { margin-top:30px; font-size:11px; color:#71717A; border-top:1px solid #ccc; padding-top:8px; }
  </style></head><body>
    <div class="brand">TK SAFETYGUARD — THE KITCHENARY OHS&amp;E</div>
    <h1>${esc(r.title || a.title)}</h1>
    <div class="sub">${esc(modeName)}</div>
    <div class="meta">
      <b>Location:</b> ${esc(a.location || "N/A")}<br/>
      <b>Assessed by:</b> ${esc(a.user_name || "N/A")}<br/>
      <b>Date:</b> ${esc(created)}<br/>
      <b>Reference:</b> ${esc(a.id)}
    </div>
    <div class="overall">OVERALL RISK: ${esc(r.overall_risk_level || "N/A")}</div>
    ${statusBanner}
    <h2>Summary</h2>
    <p>${esc(r.summary)}</p>
    ${a.notes ? `<p><b>Field notes:</b> ${esc(a.notes)}</p>` : ""}
    ${(r.hazards || []).length ? `<h2>Hazard &amp; Risk Register</h2>
    <table>
      <tr><th>Hazard</th><th>Risk</th><th>Likelihood</th><th>Consequence</th><th>Controls</th></tr>
      ${hazards}
    </table>` : ""}
    ${swms}
    ${density}
    ${machinery}
    ${actions ? `<h2>Recommended Actions</h2><ul>${actions}</ul>` : ""}
    ${refs ? `<h2>Legislative References</h2><ul>${refs}</ul>` : ""}
    <div class="foot">Generated by TK SafetyGuard AI. Aligned with the Work Health and Safety Act 2011. This document must be reviewed and signed off by a competent person before use.</div>
  </body></html>`;
}

export async function exportPdf(assessment: any) {
  const html = buildHtml(assessment);
  const { uri } = await Print.printToFileAsync({ html });
  if (Platform.OS === "web") {
    // On web, open the print dialog directly
    await Print.printAsync({ html });
    return;
  }
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Export Assessment PDF", UTI: "com.adobe.pdf" });
  }
}
