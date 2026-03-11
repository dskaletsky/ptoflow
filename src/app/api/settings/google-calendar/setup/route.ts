import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { createSharedCalendar, renameSharedCalendar, backfillOrgCalendar } from "@/lib/google-calendar";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const calendarName = (body.calendarName as string | undefined)?.trim();

  const adminUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  const adminEmail = adminUser?.email;
  if (!adminEmail) {
    return NextResponse.json({ error: "Could not determine your email address" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "google" },
    select: { refresh_token: true, scope: true },
  });

  if (!account?.refresh_token) {
    return NextResponse.json(
      { error: "No Google refresh token found. Please sign out and sign back in, then try again." },
      { status: 400 }
    );
  }

  if (!account.scope?.includes("calendar")) {
    return NextResponse.json(
      { error: `Your sign-in does not include Google Calendar permission (current scope: ${account.scope}). Please sign out, sign back in, and grant Calendar access when prompted.` },
      { status: 400 }
    );
  }

  const name = calendarName || `${org.name} PTO`;

  await prisma.organization.update({
    where: { id: orgId },
    data: { googleAdminEmail: adminEmail },
  });

  const calendarId = await createSharedCalendar(adminEmail, name);

  if (!calendarId) {
    return NextResponse.json(
      { error: "Calendar API call failed. Check the server logs for details." },
      { status: 500 }
    );
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { googleCalendarId: calendarId, googleCalendarName: name },
  });

  // Backfill all existing approved PTO to the new calendar
  await backfillOrgCalendar(orgId).catch(console.error);

  return NextResponse.json({ calendarId, googleAdminEmail: adminEmail, calendarName: name });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const body = await req.json();
  const newName = (body.calendarName as string | undefined)?.trim();

  if (!newName) {
    return NextResponse.json({ error: "Calendar name is required" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { googleCalendarId: true, googleAdminEmail: true },
  });

  if (!org?.googleCalendarId || !org?.googleAdminEmail) {
    return NextResponse.json({ error: "No calendar configured" }, { status: 400 });
  }

  const success = await renameSharedCalendar(org.googleAdminEmail, org.googleCalendarId, newName);

  if (!success) {
    return NextResponse.json({ error: "Failed to rename calendar" }, { status: 500 });
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { googleCalendarName: newName },
  });

  return NextResponse.json({ calendarName: newName });
}
