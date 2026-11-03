import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "delete unattached uploads",
  { hourUTC: 3, minuteUTC: 0 },
  internal.storage.deleteUnattachedFiles,
  {},
);

export default crons;
