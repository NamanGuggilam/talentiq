import { NextResponse } from "next/server";
import { getRecruiter } from "@/lib/auth";
import { loadDashboard, type DashParams } from "@/lib/dashboard";
import { toCsv } from "@/lib/http";
import { track } from "@/lib/metrics";

/** CSV of the filtered review list. Summary text is included only when a recruiter has approved it. */
export async function GET(req: Request) {
  const me = await getRecruiter();
  if (!me) return new NextResponse("Sign in to export.", { status: 401 });
  const params = Object.fromEntries(new URL(req.url).searchParams) as DashParams;
  const { rows } = await loadDashboard(me, params);
  const iso = (d: Date | null) => (d ? d.toISOString() : "");
  const header = ["Name", "Email", "Phone", "University", "Degree", "Major", "Graduation", "GPA", "Desired role", "Technical interests", "Preferred locations", "Skills", "Work authorization", "Recruiter", "Met at", "Connected by", "Tags", "Rating: communication (recruiter)", "Rating: technical depth (recruiter)", "Rating: interest (recruiter)", "Recommended next step", "Status", "Summary state", "Approved by", "Approved at", "Snapshot", "Key skills", "Relevant experience", "Missing information", "Last updated"];
  const body = rows.map((r) => {
    const s = r.summaryState === "approved" ? r.summary : null;
    const join = (xs?: { text: string; sources: string[] }[]) => (xs ?? []).map((x) => `${x.text} [${x.sources.join(", ")}]`).join(" ");
    return [r.name, r.email, r.phone, r.university, r.degree, r.major, r.graduationDate, r.gpa, r.desiredFunction, r.interests, r.locations, r.skills, r.workAuthorization, r.recruiterName, iso(r.metAt), r.method.toUpperCase(), r.tags, r.ratings.comm, r.ratings.tech, r.ratings.interest, r.nextStep, r.status, s ? "Approved" : r.summaryState === "none" ? "No draft" : "Not approved", r.approvedBy, iso(r.approvedAt), join(s?.snapshot), join(s?.keySkills), join(s?.relevantExperience), s?.missingInfo ?? [], iso(r.updatedAt)];
  });
  await track("export_run", { recruiterId: me.id, payload: { rows: rows.length } });
  return new NextResponse("﻿" + toCsv([header, ...body]), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="talentiq-review-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "private, no-store" },
  });
}
