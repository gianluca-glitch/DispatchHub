// DispatchHub — Activity Log Helper
// Fire-and-forget logging for admin monitoring.
// Every mutating action in Projects module calls this.

import { db } from '@/lib/db';

interface LogActivityInput {
  userId: string;
  userName: string;
  action: string;
  module: string;
  detail: string;
  projectId?: string;
  error?: string;
}

export function logActivity(input: LogActivityInput): void {
  // Fire-and-forget — don't await, don't slow down API responses
  db.activityLog
    .create({
      data: {
        userId: input.userId,
        userName: input.userName,
        action: input.action,
        module: input.module,
        detail: input.detail,
        projectId: input.projectId ?? null,
        error: input.error ?? null,
      },
    })
    .catch((err) => {
      console.error('[ActivityLog] Failed to write log:', err?.message);
    });
}
