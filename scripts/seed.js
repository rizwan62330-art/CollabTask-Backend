/**
 * Populates the database with the same demo dataset used by the Week 2
 * front end's mock API, so the two can be pointed at each other directly.
 * Safe to re-run: it wipes existing data first.
 *
 * Usage: npm run seed
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../src/db");
const { newId } = require("../src/utils/id");
const usersRepo = require("../src/modules/users/users.repository");
const projectsRepo = require("../src/modules/projects/projects.repository");
const tasksRepo = require("../src/modules/tasks/tasks.repository");
const commentsRepo = require("../src/modules/comments/comments.repository");

const DEMO_PASSWORD = "password123";

async function main() {
  console.log("Wiping existing data...");
  db.exec(`
    DELETE FROM notifications;
    DELETE FROM comments;
    DELETE FROM tasks;
    DELETE FROM project_members;
    DELETE FROM projects;
    DELETE FROM users;
  `);

  console.log("Creating users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const people = [
    { name: "Amina Yusuf", email: "amina@collabtask.dev" },
    { name: "Devon Clarke", email: "devon@collabtask.dev" },
    { name: "Priya Nair", email: "priya@collabtask.dev" },
    { name: "Marco Silva", email: "marco@collabtask.dev" },
  ];
  const users = people.map((p) => usersRepo.create({ id: newId(), name: p.name, email: p.email, passwordHash }));
  const [amina, devon, priya, marco] = users;

  console.log("Creating projects...");
  const website = projectsRepo.create({ id: newId(), name: "Website Relaunch", description: "Redesign the marketing site and migrate content to the new CMS.", color: "#3968d8", ownerId: amina.id });
  projectsRepo.addMember({ id: newId(), projectId: website.id, userId: devon.id, role: "member" });
  projectsRepo.addMember({ id: newId(), projectId: website.id, userId: priya.id, role: "member" });

  const mobile = projectsRepo.create({ id: newId(), name: "Mobile App v2", description: "Ship the redesigned onboarding flow and offline mode.", color: "#2f9e68", ownerId: devon.id });
  projectsRepo.addMember({ id: newId(), projectId: mobile.id, userId: marco.id, role: "member" });

  const campaign = projectsRepo.create({ id: newId(), name: "Q4 Marketing Campaign", description: "Plan and execute the end-of-year product marketing push.", color: "#cf9227", ownerId: priya.id });
  projectsRepo.addMember({ id: newId(), projectId: campaign.id, userId: amina.id, role: "member" });
  projectsRepo.addMember({ id: newId(), projectId: campaign.id, userId: marco.id, role: "member" });

  console.log("Creating tasks...");
  const t1 = tasksRepo.create({ id: newId(), projectId: website.id, title: "Audit existing site content", description: "Inventory all pages, flag outdated copy and broken links.", columnId: "done", priority: "medium", assigneeId: amina.id, dueDate: "2026-08-20" });
  tasksRepo.create({ id: newId(), projectId: website.id, title: "Choose CMS platform", description: "Compare headless CMS options against our editorial workflow.", columnId: "done", priority: "high", assigneeId: priya.id, dueDate: "2026-08-22" });
  const t3 = tasksRepo.create({ id: newId(), projectId: website.id, title: "Design new homepage hero", description: "Explore two directions: product-led vs. story-led hero section.", columnId: "in_progress", priority: "high", assigneeId: amina.id, dueDate: "2026-09-25" });
  tasksRepo.create({ id: newId(), projectId: website.id, title: "Set up staging environment", description: "Mirror production config so content edits can be previewed safely.", columnId: "in_progress", priority: "medium", assigneeId: devon.id, dueDate: "2026-09-28" });
  tasksRepo.create({ id: newId(), projectId: website.id, title: "Write launch announcement", description: "Draft the blog post and email for the relaunch.", columnId: "review", priority: "low", assigneeId: priya.id, dueDate: "2026-10-02" });
  tasksRepo.create({ id: newId(), projectId: website.id, title: "Migrate blog archive", description: "Move 5 years of posts into the new CMS with redirects in place.", columnId: "todo", priority: "medium", dueDate: "2026-10-10" });
  tasksRepo.create({ id: newId(), projectId: website.id, title: "Accessibility pass on new templates", description: "Run an audit against WCAG 2.1 AA before launch.", columnId: "todo", priority: "high", assigneeId: devon.id, dueDate: "2026-10-05" });

  tasksRepo.create({ id: newId(), projectId: mobile.id, title: "Define offline sync strategy", description: "Decide on conflict resolution for edits made while offline.", columnId: "todo", priority: "high", assigneeId: marco.id, dueDate: "2026-09-30" });
  tasksRepo.create({ id: newId(), projectId: mobile.id, title: "Build onboarding carousel", description: "Three-screen intro highlighting the app's core value.", columnId: "in_progress", priority: "medium", assigneeId: devon.id, dueDate: "2026-09-27" });
  tasksRepo.create({ id: newId(), projectId: mobile.id, title: "QA pass on Android build", description: "Focus on tablet layouts and rotation handling.", columnId: "review", priority: "medium", assigneeId: marco.id, dueDate: "2026-09-24" });

  tasksRepo.create({ id: newId(), projectId: campaign.id, title: "Draft campaign brief", description: "Audience, key message, and channel mix for Q4.", columnId: "todo", priority: "high", assigneeId: priya.id, dueDate: "2026-09-29" });
  tasksRepo.create({ id: newId(), projectId: campaign.id, title: "Book media placements", description: "Confirm ad slots across the two priority channels.", columnId: "todo", priority: "low", assigneeId: marco.id, dueDate: "2026-10-15" });
  tasksRepo.create({ id: newId(), projectId: campaign.id, title: "Produce launch video", description: "60-second product spot for social.", columnId: "in_progress", priority: "medium", assigneeId: priya.id, dueDate: "2026-10-08" });

  console.log("Adding comments...");
  commentsRepo.create({ id: newId(), taskId: t1.id, authorId: devon.id, body: "Spreadsheet is in the shared drive, tagged by page type." });
  commentsRepo.create({ id: newId(), taskId: t3.id, authorId: amina.id, body: "First round of concepts are in Figma, would love a look before Friday." });
  commentsRepo.create({ id: newId(), taskId: t3.id, authorId: priya.id, body: "Left comments on both — leaning toward the story-led version." });

  console.log("\nDone. Demo accounts (all use the same password):");
  users.forEach((u) => console.log(`  ${u.email}  /  ${DEMO_PASSWORD}`));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
