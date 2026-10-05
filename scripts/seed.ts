import { randomBytes } from "node:crypto";
import { db, dbReady, schema } from "../src/db";

const first = ["Ava", "Liam", "Noah", "Mia", "Ethan", "Zoe", "Lucas", "Isla", "Mason", "Ruby", "Omar", "Priya"];
const last = ["Nguyen", "Patel", "Garcia", "Smith", "Kim", "Johnson", "Lopez", "Brown", "Khan", "Davis", "Miller", "Wilson"];
const unis = ["University of Arkansas", "Texas A&M University", "Oklahoma State University", "Missouri State University"];
const majors = ["Computer Science", "Information Systems", "Industrial Engineering", "Supply Chain Management", "Data Science"];
const skillPool = ["Python", "React", "SQL", "Java", "AWS", "TypeScript", "Docker", "Excel", "Machine Learning"];
const fns = ["Software Engineering Intern", "Data Analytics Intern", "Logistics Technology Intern"];
const pick = <T,>(a: T[], i: number) => a[i % a.length];

async function main() {
await dbReady;
const [event] = await db.insert(schema.events).values({ name: "Spring Career Fair (synthetic)" }).returning();
const [recruiter] = await db.insert(schema.recruiters).values({
  name: "Demo Recruiter", email: "recruiter@example.com", eventId: event.id, connectToken: randomBytes(9).toString("base64url"),
}).returning();

for (let i = 0; i < 12; i++) {
  const skills = [0, 1, 2].map((k) => pick(skillPool, i * 2 + k));
  await db.insert(schema.candidates).values({
    firstName: first[i], lastName: pick(last, i * 5 + 1), email: `${first[i].toLowerCase()}${i}@example.edu`,
    university: pick(unis, i), major: pick(majors, i), degreeProgram: "B.S.", graduationDate: i % 2 ? "May 2027" : "December 2026",
    desiredFunction: pick(fns, i), skills, projects: [`Built a ${skills[0]} project using ${skills[1]}`], coursework: ["Data Structures", "Databases"],
  });
}
console.log(`Seeded event, recruiter (token ${recruiter.connectToken}), 12 synthetic candidates.`);
}
main().then(() => process.exit(0));
