import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifySlackSignature,
  findUserBySlackId,
  slack,
  buildManagerNotification,
  buildDenialReasonModal,
} from "@/lib/slack";
import { countWorkingDays } from "@/lib/workingDays";
import { syncApprovedRequestToCalendars } from "@/lib/google-calendar";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySlackSignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(new URLSearchParams(rawBody).get("payload") ?? "{}");

  if (payload.type === "block_actions") {
    return handleBlockActions(payload);
  }

  if (payload.type === "view_submission") {
    return handleViewSubmission(payload);
  }

  return new NextResponse(null, { status: 200 });
}

// ─────────────────────────────────────────────
// Block actions (button clicks)
// ─────────────────────────────────────────────

async function handleBlockActions(payload: SlackBlockActionsPayload) {
  const action = payload.actions?.[0];
  if (!action) return new NextResponse(null, { status: 200 });

  const requestId = action.value;
  const triggerId = payload.trigger_id;
  const channelId = payload.channel?.id ?? payload.container?.channel_id;
  const messageTs = payload.message?.ts ?? payload.container?.message_ts;
  const managerSlackId = payload.user?.id ?? "";

  if (action.action_id === "approve_request") {
    await approveRequest({ requestId, managerSlackId, channelId, messageTs }).catch(console.error);
    return new NextResponse(null, { status: 200 });
  }

  if (action.action_id === "deny_request") {
    await slack.views.open({
      trigger_id: triggerId,
      view: buildDenialReasonModal(requestId),
    }).catch(console.error);
    return new NextResponse(null, { status: 200 });
  }

  return new NextResponse(null, { status: 200 });
}

async function approveRequest({
  requestId,
  managerSlackId,
  channelId,
  messageTs,
}: {
  requestId: string;
  managerSlackId: string;
  channelId?: string;
  messageTs?: string;
}) {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      category: true,
      user: { select: { id: true, name: true, email: true, slackUserId: true } },
    },
  });

  if (!leaveRequest || leaveRequest.status !== "PENDING") return;

  const manager = await findUserBySlackId(managerSlackId);

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: "APPROVED",
      reviewedById: manager?.id ?? null,
      reviewedAt: new Date(),
    },
  });

  let remainingAfter: number | null = null;

  if (!leaveRequest.category.isUnlimited) {
    const year = new Date(leaveRequest.startDate).getFullYear();
    const bank = await prisma.leaveBank.update({
      where: {
        userId_categoryId_year: {
          userId: leaveRequest.userId,
          categoryId: leaveRequest.categoryId,
          year,
        },
      },
      data: { usedDays: { increment: leaveRequest.workingDaysCount } },
    });
    remainingAfter = bank.allocatedDays - bank.usedDays;
  }

  // Update original manager message (remove buttons)
  if (channelId && messageTs) {
    const days = `${leaveRequest.workingDaysCount} working day${leaveRequest.workingDaysCount !== 1 ? "s" : ""}`;
    const bankNote =
      remainingAfter !== null
        ? `\n*Remaining bank:* ${remainingAfter} day${remainingAfter !== 1 ? "s" : ""}`
        : "";
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: `✅ Approved: ${leaveRequest.user.name || leaveRequest.user.email} — ${leaveRequest.category.emoji} ${leaveRequest.category.name} (${days})`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ *Approved* — *${leaveRequest.user.name || leaveRequest.user.email}*\n*Type:* ${leaveRequest.category.emoji} ${leaveRequest.category.name}\n*Dates:* ${formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}\n*Duration:* ${days}${bankNote}`,
          },
        },
      ],
    }).catch(() => {
      // Non-fatal if message update fails
    });
  }

  // DM employee
  dmApprovalToEmployee(leaveRequest, remainingAfter).catch(console.error);

  // Sync to Google Calendar (fire-and-forget)
  syncApprovedRequestToCalendars(requestId).catch(console.error);
}

async function dmApprovalToEmployee(
  leaveRequest: {
    user: { id: string; name: string | null; email: string | null; slackUserId: string | null };
    category: { name: string; emoji: string; isUnlimited: boolean };
    startDate: Date;
    endDate: Date;
    workingDaysCount: number;
  },
  remainingAfter: number | null
) {
  const employeeSlackId = leaveRequest.user.slackUserId;
  if (!employeeSlackId) return;

  const days = `${leaveRequest.workingDaysCount} working day${leaveRequest.workingDaysCount !== 1 ? "s" : ""}`;
  const bankNote =
    remainingAfter !== null
      ? `\n*Days remaining in your ${leaveRequest.category.name} bank:* ${remainingAfter}`
      : "";

  await slack.chat.postMessage({
    channel: employeeSlackId,
    text: `🎉 Your PTO request has been approved!`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎉 *Congratulations! Your ${leaveRequest.category.emoji} ${leaveRequest.category.name} request has been approved.*\n\n*Dates:* ${formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}\n*Duration:* ${days}${bankNote}`,
        },
      },
    ],
  });
}

// ─────────────────────────────────────────────
// View submissions (modal submits)
// ─────────────────────────────────────────────

async function handleViewSubmission(payload: SlackViewSubmissionPayload) {
  const callbackId = payload.view?.callback_id;

  if (callbackId === "pto_request_submit") {
    return handlePtoRequestSubmit(payload);
  }

  if (callbackId === "pto_denial_submit") {
    return handleDenialReasonSubmit(payload);
  }

  return new NextResponse(null, { status: 200 });
}

async function handlePtoRequestSubmit(payload: SlackViewSubmissionPayload) {
  const values = payload.view?.state?.values ?? {};
  const categoryId = values.category_block?.category_select?.selected_option?.value ?? "";
  const startDate = values.start_date_block?.start_date_pick?.selected_date ?? "";
  const endDate = values.end_date_block?.end_date_pick?.selected_date ?? "";
  const description = values.note_block?.note_input?.value ?? null;
  const slackUserId = payload.user?.id ?? "";
  const oooChecked = (values.ooo_block?.ooo_checkbox?.selected_options ?? []).some(
    (o: { value: string }) => o.value === "ooo"
  );

  // Await core processing (DB + Slack DMs) before responding.
  // Vercel terminates the function when the response is sent, so fire-and-forget
  // doesn't work — we must complete all work before returning.
  // Calendar sync is fire-and-forget inside processRequestSubmission since it's
  // non-critical and we can't wait for it within Slack's 3s window.
  await processRequestSubmission({ slackUserId, categoryId, startDate, endDate, description, markAsOOO: oooChecked }).catch(console.error);

  return new NextResponse(null, { status: 200 });
}

async function processRequestSubmission({
  slackUserId,
  categoryId,
  startDate,
  endDate,
  description,
  markAsOOO,
}: {
  slackUserId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  description: string | null;
  markAsOOO: boolean;
}) {
  const dmError = async (msg: string) => {
    if (slackUserId) {
      await slack.chat.postMessage({
        channel: slackUserId,
        text: `⚠️ ${msg}`,
      }).catch(console.error);
    }
  };

  const user = await findUserBySlackId(slackUserId);
  if (!user || !user.organizationId) {
    return dmError("Could not find your PTOFlow account. Please sign in to PTOFlow first.");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return dmError("Invalid dates provided. Please try again.");
  }

  if (end < start) {
    return dmError("End date must be on or after start date. Please try again.");
  }

  const [holidays, category] = await Promise.all([
    prisma.companyHoliday.findMany({
      where: { organizationId: user.organizationId },
      select: { date: true },
    }),
    prisma.leaveCategory.findUnique({ where: { id: categoryId } }),
  ]);

  if (!category || category.organizationId !== user.organizationId) {
    return dmError("Invalid leave category. Please try again.");
  }

  // Check for overlapping approved PTO
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId: user.id,
      status: "APPROVED",
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: { category: true },
  });

  if (overlapping) {
    const overlapStart = overlapping.startDate > start ? overlapping.startDate : start;
    const overlapEnd = overlapping.endDate < end ? overlapping.endDate : end;
    const sharedWorkingDays = countWorkingDays(overlapStart, overlapEnd, holidays.map((h) => h.date));

    if (sharedWorkingDays > 0) {
      const fmt = (d: Date) => new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });
      const dateStr = overlapping.startDate.toDateString() === overlapping.endDate.toDateString()
        ? fmt(overlapping.startDate)
        : `${fmt(overlapping.startDate)} – ${fmt(overlapping.endDate)}`;
      return dmError(`${overlapping.category.emoji} You already have approved PTO for that date. Existing approval: ${dateStr}.`);
    }
  }

  const workingDaysCount = countWorkingDays(start, end, holidays.map((h) => h.date));

  if (workingDaysCount === 0) {
    return dmError("Your selected dates contain no working days. Please try again.");
  }

  let remainingAfter: number | null = null;

  if (!category.isUnlimited) {
    const year = start.getFullYear();
    const bank = await prisma.leaveBank.findUnique({
      where: { userId_categoryId_year: { userId: user.id, categoryId, year } },
    });

    if (!bank) {
      return dmError("No leave bank found for this category.");
    }

    const remaining = bank.allocatedDays - bank.usedDays;
    if (workingDaysCount > remaining) {
      return dmError(`Insufficient balance. You have ${remaining} day(s) remaining but requested ${workingDaysCount}.`);
    }
    remainingAfter = remaining - workingDaysCount;
  }

  const noApprover = !user.managerId;
  const status = !category.requiresApproval || noApprover ? "APPROVED" : "PENDING";

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      categoryId,
      startDate: start,
      endDate: end,
      workingDaysCount,
      description: description || null,
      status,
      markAsOOO,
    },
    include: {
      category: true,
      user: { select: { id: true, name: true, email: true, slackUserId: true } },
    },
  });

  if (status === "APPROVED" && !category.isUnlimited) {
    const year = start.getFullYear();
    await prisma.leaveBank.update({
      where: { userId_categoryId_year: { userId: user.id, categoryId, year } },
      data: { usedDays: { increment: workingDaysCount } },
    });
  }

  // Sync to Google Calendar if auto-approved (fire-and-forget)
  if (status === "APPROVED") {
    syncApprovedRequestToCalendars(leaveRequest.id).catch(console.error);
  }

  await sendRequestNotifications(leaveRequest, remainingAfter);
}

async function sendRequestNotifications(
  leaveRequest: {
    id: string;
    status: string;
    user: { id: string; name: string | null; email: string | null; slackUserId: string | null };
    category: { name: string; emoji: string };
    startDate: Date;
    endDate: Date;
    workingDaysCount: number;
  },
  remainingAfter: number | null
) {
  const employeeSlackId = leaveRequest.user.slackUserId;
  const days = `${leaveRequest.workingDaysCount} working day${leaveRequest.workingDaysCount !== 1 ? "s" : ""}`;

  const { emoji, name: categoryName } = leaveRequest.category;
  const employeeName = leaveRequest.user.name || leaveRequest.user.email;

  // Find manager for both auto-approved and pending paths
  const fullUser = await prisma.user.findUnique({
    where: { id: leaveRequest.user.id },
    include: { manager: true },
  });
  const manager = fullUser?.manager;

  if (leaveRequest.status === "APPROVED") {
    // Auto-approved: DM employee confirmation
    if (employeeSlackId) {
      const bankNote =
        remainingAfter !== null
          ? `\n*Days remaining in your ${categoryName} bank:* ${remainingAfter}`
          : "";
      await slack.chat.postMessage({
        channel: employeeSlackId,
        text: `✅ Your PTO request has been automatically approved`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ *Your ${emoji} ${categoryName} request has been automatically approved.*\n\n*Dates:* ${formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}\n*Duration:* ${days}${bankNote}`,
            },
          },
        ],
      });
    }

    // Notify manager that employee is taking PTO (no action needed)
    if (manager?.slackUserId) {
      await slack.chat.postMessage({
        channel: manager.slackUserId,
        text: `${emoji} ${employeeName} is taking PTO!`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *${employeeName} is taking PTO!*\n\n*Type:* ${emoji} ${categoryName}\n*Dates:* ${formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}\n*Duration:* ${days}`,
            },
          },
        ],
      });
    }
    return;
  }

  // Pending: DM employee confirmation + DM manager with action buttons
  if (employeeSlackId) {
    await slack.chat.postMessage({
      channel: employeeSlackId,
      text: `${emoji} Your PTO request has been submitted`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *Your ${categoryName} request has been submitted.*\n\nYour manager will review it shortly.\n\n*Dates:* ${formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}\n*Duration:* ${days}`,
          },
        },
      ],
    });
  }

  if (!manager?.slackUserId) return;

  const fullRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequest.id },
    include: {
      category: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!fullRequest) return;

  await slack.chat.postMessage({
    channel: manager.slackUserId,
    text: `New PTO request from ${employeeName}`,
    blocks: buildManagerNotification(fullRequest, remainingAfter),
  });
}

async function handleDenialReasonSubmit(payload: SlackViewSubmissionPayload) {
  const requestId = payload.view?.private_metadata ?? "";
  const reason =
    payload.view?.state?.values?.reason_block?.reason_input?.value ?? null;
  const managerSlackId = payload.user?.id ?? "";

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      category: true,
      user: { select: { id: true, name: true, email: true, slackUserId: true } },
    },
  });

  if (!leaveRequest || leaveRequest.status !== "PENDING") {
    return new NextResponse(null, { status: 200 });
  }

  const manager = await findUserBySlackId(managerSlackId);

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      rejectionReason: reason || null,
      reviewedById: manager?.id ?? null,
      reviewedAt: new Date(),
    },
  });

  // DM employee async
  dmDenialToEmployee(leaveRequest, reason).catch(console.error);

  return new NextResponse(null, { status: 200 });
}

async function dmDenialToEmployee(
  leaveRequest: {
    user: { slackUserId: string | null };
    category: { name: string; emoji: string };
    startDate: Date;
    endDate: Date;
    workingDaysCount: number;
  },
  reason: string | null
) {
  const employeeSlackId = leaveRequest.user.slackUserId;
  if (!employeeSlackId) return;

  const days = `${leaveRequest.workingDaysCount} working day${leaveRequest.workingDaysCount !== 1 ? "s" : ""}`;
  const reasonNote = reason ? `\n*Reason:* ${reason}` : "";

  await slack.chat.postMessage({
    channel: employeeSlackId,
    text: `❌ Your PTO request has been denied`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `❌ *Your ${leaveRequest.category.emoji} ${leaveRequest.category.name} request has been denied.*\n\n*Dates:* ${formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}\n*Duration:* ${days}${reasonNote}`,
        },
      },
    ],
  });
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function pushErrorModal(message: string) {
  return NextResponse.json({
    response_action: "push",
    view: {
      type: "modal",
      title: { type: "plain_text", text: "Error" },
      close: { type: "plain_text", text: "Close" },
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `⚠️ ${message}` },
        },
      ],
    },
  });
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const s = fmt(start);
  const e = fmt(end);
  return s === e ? s : `${s} – ${e}`;
}

// ─────────────────────────────────────────────
// Minimal payload types
// ─────────────────────────────────────────────

interface SlackBlockActionsPayload {
  type: "block_actions";
  trigger_id: string;
  user?: { id: string };
  channel?: { id: string };
  container?: { channel_id?: string; message_ts?: string };
  message?: { ts: string; blocks?: object[] };
  actions?: Array<{ action_id: string; value: string }>;
}

interface SlackViewSubmissionPayload {
  type: "view_submission";
  user?: { id: string };
  view?: {
    callback_id: string;
    private_metadata?: string;
    state?: {
      values?: Record<
        string,
        Record<
          string,
          {
            value?: string;
            selected_option?: { value: string };
            selected_options?: Array<{ value: string }>;
            selected_date?: string;
          }
        >
      >;
    };
  };
}
