import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { createSharedCalendar, renameSharedCalendar, backfillTeamCalendar, deleteSharedCalendar } from "@/lib/google-calendar";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const { id: teamId } = await params;

  const [org, team, adminUser] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { googleAdminEmail: true },
    }),
    prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, organizationId: true, googleCalendarId: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    }),
  ]);

  if (!team || team.organizationId !== orgId) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (!org?.googleAdminEmail) {
    return NextResponse.json(
      { error: "Please configure your All Company Calendar first (Settings → Calendars)." },
      { status: 400 }
    );
  }

  if (team.googleCalendarId) {
    return NextResponse.json(
      { error: "This team already has a calendar configured.", calendarId: team.googleCalendarId },
      { status: 409 }
    );
  }

  const calendarName = `${team.name} PTO`;
  const calendarId = await createSharedCalendar(org.googleAdminEmail, calendarName);

  if (!calendarId) {
    return NextResponse.json(
      { error: "Failed to create calendar. Make sure you have signed in with Google Calendar permissions (sign out and back in if needed)." },
      { status: 500 }
    );
  }

  const now = new Date();
  await prisma.team.update({
    where: { id: teamId },
    data: {
      googleCalendarId: calendarId,
      googleCalendarName: calendarName,
      googleCalendarCreatedAt: now,
      googleCalendarOwner: adminUser?.email ?? org.googleAdminEmail,
    },
  });

  // Backfill all existing approved PTO for this team
  await backfillTeamCalendar(teamId).catch(console.error);

  return NextResponse.json({
    calendarId,
    calendarName,
    calendarCreatedAt: now.toISOString(),
    calendarOwner: adminUser?.email ?? org.googleAdminEmail,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const { id: teamId } = await params;
  const body = await req.json();
  const newName = (body.calendarName as string | undefined)?.trim();

  if (!newName) {
    return NextResponse.json({ error: "Calendar name is required" }, { status: 400 });
  }

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

  const success = await renameSharedCalendar(org.googleAdminEmail, team.googleCalendarId, newName);

  if (!success) {
    return NextResponse.json({ error: "Failed to rename calendar" }, { status: 500 });
  }

  await prisma.team.update({
    where: { id: teamId },
    data: { googleCalendarName: newName },
  });

  return NextResponse.json({ calendarName: newName });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

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

  if (!team.googleCalendarId) {
    return NextResponse.json({ error: "No calendar configured for this team" }, { status: 400 });
  }

  if (org?.googleAdminEmail) {
    await deleteSharedCalendar(org.googleAdminEmail, team.googleCalendarId).catch(console.error);
  }

  await prisma.team.update({
    where: { id: teamId },
    data: {
      googleCalendarId: null,
      googleCalendarName: null,
      googleCalendarCreatedAt: null,
      googleCalendarOwner: null,
    },
  });

  return NextResponse.json({ success: true });
}
