import {
  LeaveRequest,
  LeaveCategory,
  User,
  LeaveBank,
  LeaveRequestStatus,
} from "@prisma/client";

export type LeaveRequestWithRelations = LeaveRequest & {
  user: Pick<User, "id" | "name" | "email" | "image">;
  category: Pick<LeaveCategory, "id" | "name" | "emoji">;
};

export type BankSummary = {
  categoryId: string;
  categoryName: string;
  categoryEmoji: string;
  isUnlimited: boolean;
  allocatedDays: number | null;
  usedDays: number;
  remainingDays: number | null;
  minimumDays: number | null;
  year: number;
};

export type CreateLeaveRequestInput = {
  categoryId: string;
  startDate: Date;
  endDate: Date;
  description?: string;
};

export type LeaveRequestDecision = {
  requestId: string;
  status: Extract<LeaveRequestStatus, "APPROVED" | "REJECTED">;
  rejectionReason?: string;
};
