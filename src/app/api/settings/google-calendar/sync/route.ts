import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { syncApprovedRequestToCalendars, backfillTeamCalendar } from "@/lib/google-calendar";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { googleCalendarId: true, googleAdminEmail: true },
  });

  if (!org?.googleCalendarId || !org?.googleAdminEmail) {
    return NextResponse.json(
      { error: "No calendar configured. Create an All Company Calendar first." },
      { status: 400 }
    );
  }

  // Find all approved requests not yet on the org calendar
  const unsyncedOrg = await prisma.leaveRequest.findMany({
    where: {
      googleOrgCalendarEventId: null,
      status: "APPROVED",
      user: { organizationId: orgId },
    },
    select: { id: true },
  });

  // Sync org calendar sequentially to avoid hammering the Google Calendar API
  let synced = 0;
  for (const req of unsyncedOrg) {
    await syncApprovedRequestToCalendars(req.id);
    synced++;
  }

  // Backfill all team calendars in the org
  const teamsWithCalendars = await prisma.team.findMany({
    where: { organizationId: orgId, googleCalendarId: { not: null } },
    select: { id: true },
  });

  for (const team of teamsWithCalendars) {
    await backfillTeamCalendar(team.id);
  }

  return NextResponse.json({ synced });
}
