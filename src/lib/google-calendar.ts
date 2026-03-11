import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────
// Per-user OAuth client (for OOO events on personal calendar)
// ─────────────────────────────────────────────

async function getUserCalendarClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { access_token: true, refresh_token: true, scope: true },
  });

  if (!account?.refresh_token) return null;

  // Verify token has calendar scope
  if (!account.scope?.includes("calendar")) {
    console.warn(`[GoogleCalendar] User ${userId} token missing calendar scope — skipping OOO`);
    return null;
  }

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

// ─────────────────────────────────────────────
// Admin OAuth client (for shared calendars — uses the admin user's stored credentials)
// ─────────────────────────────────────────────

async function getAdminCalendarClient(adminEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (!user) {
    console.warn(`[GoogleCalendar] Admin user not found for email: ${adminEmail}`);
    return null;
  }

  return getUserCalendarClient(user.id);
}

// ─────────────────────────────────────────────
// OOO event operations (personal calendar)
// ─────────────────────────────────────────────

async function createOOOEvent(
  userId: string,
  leaveRequest: { startDate: Date; endDate: Date; markAsOOO: boolean; id: string }
): Promise<string | null> {
  if (!leaveRequest.markAsOOO) return null;

  const auth = await getUserCalendarClient(userId);
  if (!auth) return null;

  try {
    const calendar = google.calendar({ version: "v3", auth });

    // End date is exclusive for all-day events
    const endDate = new Date(leaveRequest.endDate);
    endDate.setDate(endDate.getDate() + 1);

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: "Out of Office",
        eventType: "outOfOffice",
        start: { date: toDateString(leaveRequest.startDate) },
        end: { date: toDateString(endDate) },
        outOfOfficeProperties: {
          autoDeclineMode: "allEvents",
        },
      },
    });

    return event.data.id ?? null;
  } catch (err) {
    console.error("[GoogleCalendar] Failed to create OOO event:", err);
    return null;
  }
}

async function deleteOOOEvent(userId: string, eventId: string): Promise<void> {
  const auth = await getUserCalendarClient(userId);
  if (!auth) return;

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (err) {
    console.error("[GoogleCalendar] Failed to delete OOO event:", err);
  }
}

// ─────────────────────────────────────────────
// Shared calendar operations (domain-wide delegation)
// ─────────────────────────────────────────────

export async function renameSharedCalendar(
  adminEmail: string,
  calendarId: string,
  newName: string
): Promise<boolean> {
  const auth = await getAdminCalendarClient(adminEmail);
  if (!auth) return false;

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.calendars.update({
      calendarId,
      requestBody: { summary: newName },
    });
    return true;
  } catch (err) {
    console.error("[GoogleCalendar] Failed to rename calendar:", err);
    return false;
  }
}

export async function deleteSharedCalendar(
  adminEmail: string,
  calendarId: string
): Promise<boolean> {
  const auth = await getAdminCalendarClient(adminEmail);
  if (!auth) return false;

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.calendars.delete({ calendarId });
    return true;
  } catch (err) {
    console.error("[GoogleCalendar] Failed to delete calendar:", err);
    return false;
  }
}

export async function createSharedCalendar(
  adminEmail: string,
  calendarName: string
): Promise<string | null> {
  const auth = await getAdminCalendarClient(adminEmail);
  if (!auth) return null;

  try {
    const calendar = google.calendar({ version: "v3", auth });

    const newCal = await calendar.calendars.insert({
      requestBody: { summary: calendarName },
    });

    const calendarId = newCal.data.id;
    if (!calendarId) return null;

    // Extract domain from admin email (e.g. company.com from admin@company.com)
    const domain = adminEmail.split("@")[1];

    // Grant read access to entire domain
    await calendar.acl.insert({
      calendarId,
      requestBody: {
        role: "reader",
        scope: { type: "domain", value: domain },
      },
    });

    return calendarId;
  } catch (err) {
    console.error("[GoogleCalendar] Failed to create shared calendar:", err);
    return null;
  }
}

async function addPTOEventToCalendar(
  adminEmail: string,
  calendarId: string,
  leaveRequest: { startDate: Date; endDate: Date },
  user: { name: string | null; email: string | null },
  category: { emoji: string; name: string }
): Promise<string | null> {
  const auth = await getAdminCalendarClient(adminEmail);
  if (!auth) return null;

  try {
    const calendar = google.calendar({ version: "v3", auth });

    const displayName = formatDisplayName(user.name, user.email);
    const endDate = new Date(leaveRequest.endDate);
    endDate.setDate(endDate.getDate() + 1);

    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${displayName} ${category.emoji}`,
        start: { date: toDateString(leaveRequest.startDate) },
        end: { date: toDateString(endDate) },
      },
    });

    return event.data.id ?? null;
  } catch (err) {
    console.error("[GoogleCalendar] Failed to add PTO event to shared calendar:", err);
    return null;
  }
}

async function deletePTOEventFromCalendar(
  adminEmail: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const auth = await getAdminCalendarClient(adminEmail);
  if (!auth) return;

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId, eventId });
  } catch (err) {
    console.error("[GoogleCalendar] Failed to delete PTO event from shared calendar:", err);
  }
}

// ─────────────────────────────────────────────
// Orchestration helpers
// ─────────────────────────────────────────────

export async function backfillOrgCalendar(orgId: string): Promise<void> {
  const unsynced = await prisma.leaveRequest.findMany({
    where: { googleOrgCalendarEventId: null, status: "APPROVED", user: { organizationId: orgId } },
    select: { id: true },
  });
  for (const req of unsynced) {
    await syncApprovedRequestToCalendars(req.id);
  }
}

export async function backfillTeamCalendar(teamId: string): Promise<void> {
  // Fetch all approved requests for users on this team
  const allRequests = await prisma.leaveRequest.findMany({
    where: { status: "APPROVED", user: { teams: { some: { id: teamId } } } },
    select: { id: true, teamCalendarEventIds: true },
  });
  // Only sync those that don't already have an event for this specific team
  const unsynced = allRequests.filter(req => {
    const ids = req.teamCalendarEventIds as Record<string, string> | null;
    return !ids || !ids[teamId];
  });
  for (const req of unsynced) {
    await syncApprovedRequestToCalendars(req.id);
  }
}

export async function syncApprovedRequestToCalendars(requestId: string): Promise<void> {
  try {
    const req = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            organizationId: true,
            teams: { select: { id: true, googleCalendarId: true } },
          },
        },
        category: { select: { emoji: true, name: true } },
      },
    });

    if (!req || req.status !== "APPROVED") return;

    const org = req.user.organizationId
      ? await prisma.organization.findUnique({
          where: { id: req.user.organizationId },
          select: { googleAdminEmail: true, googleCalendarId: true },
        })
      : null;

    // OOO on personal calendar + All Company calendar
    const [oooEventId, orgEventId] = await Promise.all([
      createOOOEvent(req.userId, req),
      org?.googleAdminEmail && org?.googleCalendarId
        ? addPTOEventToCalendar(org.googleAdminEmail, org.googleCalendarId, req, req.user, req.category)
        : Promise.resolve(null),
    ]);

    // Events on all team calendars the user belongs to
    const existingTeamEventIds = (req.teamCalendarEventIds as Record<string, string> | null) ?? {};
    const newTeamEventIds: Record<string, string> = { ...existingTeamEventIds };

    if (org?.googleAdminEmail) {
      const teamsWithCalendar = req.user.teams.filter(t => t.googleCalendarId && !existingTeamEventIds[t.id]);
      await Promise.all(
        teamsWithCalendar.map(async team => {
          const eventId = await addPTOEventToCalendar(org.googleAdminEmail!, team.googleCalendarId!, req, req.user, req.category);
          if (eventId) newTeamEventIds[team.id] = eventId;
        })
      );
    }

    // Persist event IDs
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        googleOOOEventId: oooEventId ?? undefined,
        teamCalendarEventIds: newTeamEventIds,
        googleOrgCalendarEventId: orgEventId ?? undefined,
      },
    });
  } catch (err) {
    console.error("[GoogleCalendar] syncApprovedRequestToCalendars failed:", err);
  }
}

export async function removeRequestFromCalendars(requestId: string): Promise<void> {
  try {
    const req = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    });

    if (!req) return;

    const org = req.user.organizationId
      ? await prisma.organization.findUnique({
          where: { id: req.user.organizationId },
          select: { googleAdminEmail: true, googleCalendarId: true },
        })
      : null;

    const teamEventIds = (req.teamCalendarEventIds as Record<string, string> | null) ?? {};

    // Fetch team calendar IDs for all teams that have stored event IDs
    const teamIds = Object.keys(teamEventIds);
    const teamsWithCalendars = teamIds.length > 0
      ? await prisma.team.findMany({
          where: { id: { in: teamIds }, googleCalendarId: { not: null } },
          select: { id: true, googleCalendarId: true },
        })
      : [];

    await Promise.all([
      req.googleOOOEventId
        ? deleteOOOEvent(req.userId, req.googleOOOEventId)
        : Promise.resolve(),
      // Delete from all team calendars
      ...teamsWithCalendars.map(team => {
        const eventId = teamEventIds[team.id];
        return eventId && org?.googleAdminEmail && team.googleCalendarId
          ? deletePTOEventFromCalendar(org.googleAdminEmail, team.googleCalendarId, eventId)
          : Promise.resolve();
      }),
      req.googleOrgCalendarEventId && org?.googleAdminEmail && org?.googleCalendarId
        ? deletePTOEventFromCalendar(org.googleAdminEmail, org.googleCalendarId, req.googleOrgCalendarEventId)
        : Promise.resolve(),
    ]);

    // Clear event IDs from record
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        googleOOOEventId: null,
        teamCalendarEventIds: {},
        googleOrgCalendarEventId: null,
      },
    });
  } catch (err) {
    console.error("[GoogleCalendar] removeRequestFromCalendars failed:", err);
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function toDateString(date: Date): string {
  // Returns YYYY-MM-DD in UTC to match how dates are stored
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayName(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
    }
    return name;
  }
  return email?.split("@")[0] ?? "Employee";
}
