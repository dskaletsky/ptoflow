import { WebClient } from "@slack/web-api";
import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { LeaveBank, LeaveCategory, LeaveRequest, User } from "@prisma/client";

// ─────────────────────────────────────────────
// WebClient singleton
// ─────────────────────────────────────────────

const globalForSlack = globalThis as unknown as {
  slack: WebClient | undefined;
};

export const slack =
  globalForSlack.slack ?? new WebClient(process.env.SLACK_BOT_TOKEN!);

if (process.env.NODE_ENV !== "production") globalForSlack.slack = slack;

// ─────────────────────────────────────────────
// Signature verification
// ─────────────────────────────────────────────

export function verifySlackSignature(rawBody: string, headers: Headers): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;
  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(sigBaseString)
    .digest("hex");
  const computed = `v0=${hmac}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// User matching
// ─────────────────────────────────────────────

export async function findUserBySlackId(slackUserId: string) {
  // Fast path: already linked
  const bySlackId = await prisma.user.findUnique({
    where: { slackUserId },
    include: {
      manager: true,
      organization: true,
    },
  });
  if (bySlackId) return bySlackId;

  // Slow path: look up email via Slack API
  try {
    const info = await slack.users.info({ user: slackUserId });
    const email = (info.user as { profile?: { email?: string } })?.profile?.email;
    if (!email) return null;

    const byEmail = await prisma.user.findUnique({
      where: { email },
      include: {
        manager: true,
        organization: true,
      },
    });

    if (byEmail) {
      // Cache slackUserId for future lookups
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { slackUserId },
      });
      return { ...byEmail, slackUserId };
    }
  } catch {
    // Slack API error — fall through
  }

  return null;
}

// ─────────────────────────────────────────────
// Block Kit builders
// ─────────────────────────────────────────────

type CategoryForModal = Pick<LeaveCategory, "id" | "name" | "emoji">;

export function buildRequestModal(categories: CategoryForModal[]) {
  return {
    type: "modal" as const,
    callback_id: "pto_request_submit",
    title: { type: "plain_text" as const, text: "Request Time Off" },
    submit: { type: "plain_text" as const, text: "Submit" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "category_block",
        label: { type: "plain_text" as const, text: "Type of Leave" },
        element: {
          type: "static_select",
          action_id: "category_select",
          placeholder: { type: "plain_text" as const, text: "Select leave type" },
          options: categories.map((c) => ({
            text: { type: "plain_text" as const, text: `${c.emoji} ${c.name}` },
            value: c.id,
          })),
        },
      },
      {
        type: "input",
        block_id: "start_date_block",
        label: { type: "plain_text" as const, text: "Start Date" },
        element: {
          type: "datepicker",
          action_id: "start_date_pick",
          placeholder: { type: "plain_text" as const, text: "Select start date" },
        },
      },
      {
        type: "input",
        block_id: "end_date_block",
        label: { type: "plain_text" as const, text: "End Date" },
        element: {
          type: "datepicker",
          action_id: "end_date_pick",
          placeholder: { type: "plain_text" as const, text: "Select end date" },
        },
      },
      {
        type: "input",
        block_id: "note_block",
        optional: true,
        label: { type: "plain_text" as const, text: "Note (optional)" },
        element: {
          type: "plain_text_input",
          action_id: "note_input",
          multiline: true,
          placeholder: { type: "plain_text" as const, text: "Add a note for your manager..." },
        },
      },
      {
        type: "input",
        block_id: "ooo_block",
        optional: true,
        label: { type: "plain_text" as const, text: "Out of Office" },
        element: {
          type: "checkboxes",
          action_id: "ooo_checkbox",
          options: [
            {
              text: { type: "mrkdwn" as const, text: "Mark me as Out of Office (no meeting invites during this period)" },
              value: "ooo",
            },
          ],
          initial_options: [
            {
              text: { type: "mrkdwn" as const, text: "Mark me as Out of Office (no meeting invites during this period)" },
              value: "ooo",
            },
          ],
        },
      },
    ],
  };
}

type RequestForNotification = LeaveRequest & {
  category: LeaveCategory;
  user: Pick<User, "name" | "email">;
};

export function buildManagerNotification(
  request: RequestForNotification,
  remainingAfter: number | null
) {
  const { category, user, startDate, endDate, workingDaysCount, id } = request;
  const dateRange = formatDateRange(startDate, endDate);
  const days = `${workingDaysCount} working day${workingDaysCount !== 1 ? "s" : ""}`;
  const bankNote =
    remainingAfter !== null
      ? `\n*Remaining bank after approval:* ${remainingAfter} day${remainingAfter !== 1 ? "s" : ""}`
      : "";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*New PTO Request* from *${user.name || user.email}*\n*Type:* ${category.emoji} ${category.name}\n*Dates:* ${dateRange}\n*Duration:* ${days}${bankNote}`,
      },
    },
    {
      type: "actions",
      block_id: `request_actions_${id}`,
      elements: [
        {
          type: "button",
          action_id: "approve_request",
          text: { type: "plain_text" as const, text: "✅ Approve" },
          style: "primary",
          value: id,
          confirm: {
            title: { type: "plain_text" as const, text: "Approve Request?" },
            text: { type: "mrkdwn" as const, text: `Approve ${days} of ${category.emoji} ${category.name} for ${user.name || user.email}?` },
            confirm: { type: "plain_text" as const, text: "Approve" },
            deny: { type: "plain_text" as const, text: "Cancel" },
          },
        },
        {
          type: "button",
          action_id: "deny_request",
          text: { type: "plain_text" as const, text: "❌ Deny" },
          style: "danger",
          value: id,
        },
      ],
    },
  ];
}

export function buildDenialReasonModal(requestId: string) {
  return {
    type: "modal" as const,
    callback_id: "pto_denial_submit",
    private_metadata: requestId,
    title: { type: "plain_text" as const, text: "Deny Request" },
    submit: { type: "plain_text" as const, text: "Send" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "reason_block",
        optional: true,
        label: { type: "plain_text" as const, text: "Reason for denial (optional)" },
        element: {
          type: "plain_text_input",
          action_id: "reason_input",
          multiline: true,
          placeholder: { type: "plain_text" as const, text: "Explain why this request was denied..." },
        },
      },
    ],
  };
}

type BankWithCategory = LeaveBank & { category: LeaveCategory };

export function buildStatusMessage(banks: BankWithCategory[]) {
  if (banks.length === 0) {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: "No leave banks found for this year." },
      },
    ];
  }

  const lines = banks.map((b) => {
    if (b.category.isUnlimited) {
      return `${b.category.emoji} *${b.category.name}:* Unlimited`;
    }
    const remaining = b.allocatedDays - b.usedDays;
    return `${b.category.emoji} *${b.category.name}:* ${remaining} day${remaining !== 1 ? "s" : ""} remaining (${b.usedDays} used of ${b.allocatedDays})`;
  });

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Your Leave Balances — ${new Date().getFullYear()}*\n\n${lines.join("\n")}`,
      },
    },
  ];
}

type PendingRequest = LeaveRequest & {
  category: LeaveCategory;
  user: Pick<User, "name" | "email">;
};

export function buildPendingRequestsMessage(requests: PendingRequest[]) {
  if (requests.length === 0) {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: "No pending requests. 🎉" },
      },
    ];
  }

  const blocks: object[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Pending PTO Requests* (${requests.length})`,
      },
    },
    { type: "divider" },
  ];

  for (const req of requests) {
    const days = `${req.workingDaysCount} working day${req.workingDaysCount !== 1 ? "s" : ""}`;
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${req.user.name || req.user.email}* — ${req.category.emoji} ${req.category.name}\n${formatDateRange(req.startDate, req.endDate)} · ${days}`,
        },
      },
      {
        type: "actions",
        block_id: `request_actions_${req.id}`,
        elements: [
          {
            type: "button",
            action_id: "approve_request",
            text: { type: "plain_text" as const, text: "✅ Approve" },
            style: "primary",
            value: req.id,
            confirm: {
              title: { type: "plain_text" as const, text: "Approve Request?" },
              text: { type: "mrkdwn" as const, text: `Approve ${days} of ${req.category.emoji} ${req.category.name} for ${req.user.name || req.user.email}?` },
              confirm: { type: "plain_text" as const, text: "Approve" },
              deny: { type: "plain_text" as const, text: "Cancel" },
            },
          },
          {
            type: "button",
            action_id: "deny_request",
            text: { type: "plain_text" as const, text: "❌ Deny" },
            style: "danger",
            value: req.id,
          },
        ],
      }
    );
  }

  return blocks;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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
