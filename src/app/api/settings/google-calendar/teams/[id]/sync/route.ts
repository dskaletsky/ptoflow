import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { backfillTeamCalendar } from "@/lib/google-calendar";
import { google } from "googleapis";

async function getAdminCalendarClient(adminEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
  if (!user) return null;

  const account = await prisma.account.findFirst({
    where: { userId: user.id, provider: "google" },
    select: { access_token: true, refresh_token: true },
  });
  if (!account?.refresh_token) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
  oauth2Client.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token,
  });
  return oauth2Client;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) return NextResponse.json({ error: "No organization found" }, { status: 400 });

  const { id: teamId } = await params;

  const [org, team] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { googleAdminEmail: true },
    }),
    prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, organizationId: true, googleCalendarId: true },
    }),
  ]);

  if (!team || team.organizationId !== orgId) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  if (!team.googleCalendarId || !org?.googleAdminEmail) {
    return NextResponse.json({ error: "No calendar configured for this team" }, { status: 400 });
  }

  // Find all approved requests that already have an event ID stored for this team
  const synced = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      user: { teams: { some: { id: teamId } } },
    },
    select: { id: true, teamCalendarEventIds: true },
  });

  const toDelete = synced.filter(req => {
    const ids = req.teamCalendarEventIds as Record<string, string> | null;
    return ids && ids[teamId];
  });

  // Delete existing events from Google Calendar and clear their IDs
  if (toDelete.length > 0) {
    const auth = await getAdminCalendarClient(org.googleAdminEmail);
    if (auth) {
      const calendar = google.calendar({ version: "v3", auth });
      await Promise.all(
        toDelete.map(async req => {
          const ids = req.teamCalendarEventIds as Record<string, string>;
          try {
            await calendar.events.delete({ calendarId: team.googleCalendarId!, eventId: ids[teamId] });
          } catch {
            // Event may already be deleted — ignore
          }
          // Clear this team's event ID from the map
          const updated = { ...ids };
          delete updated[teamId];
          await prisma.leaveRequest.update({
            where: { id: req.id },
            data: { teamCalendarEventIds: updated },
          });
        })
      );
    }
  }

  // Re-create all events with correct dates
  await backfillTeamCalendar(teamId);

  return NextResponse.json({ synced: toDelete.length });
}
