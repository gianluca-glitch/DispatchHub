'use client';

import { Button } from '@/components/ui/button';
import { Check, X, Pause, Pencil, Flag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ApprovalActionsProps {
  status: string;
  editMode: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onHold: () => void;
  onEdit: () => void;
  onFlag: () => void;
  loading?: boolean;
  /** When true, Approve button is hidden (e.g. when using Preview Mode Confirm & Schedule) */
  hideApprove?: boolean;
  className?: string;
}

export function ApprovalActions({
  status,
  editMode,
  onApprove,
  onDecline,
  onHold,
  onEdit,
  onFlag,
  loading = false,
  hideApprove = false,
  className,
}: ApprovalActionsProps) {
  const isFinal = status === 'APPROVED' || status === 'DECLINED';

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        className
      )}
    >
      {!hideApprove && (
      <Button
        size="sm"
        className="bg-success/20 text-success border border-success/40 hover:bg-success/30"
        onClick={onApprove}
        disabled={loading || isFinal}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        <span className="ml-1">Approve</span>
      </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="border-danger/40 text-danger hover:bg-danger/10"
        onClick={onDecline}
        disabled={loading || isFinal}
      >
        <X className="h-3.5 w-3.5" />
        <span className="ml-1">Decline</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-amber/40 text-amber hover:bg-amber/10"
        onClick={onHold}
        disabled={loading || isFinal}
      >
        <Pause className="h-3.5 w-3.5" />
        <span className="ml-1">Hold</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-info/40 text-info hover:bg-info/10"
        onClick={onEdit}
        disabled={loading || isFinal}
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="ml-1">Edit</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-purple/40 text-purple hover:bg-purple/10"
        onClick={onFlag}
        disabled={loading || isFinal}
      >
        <Flag className="h-3.5 w-3.5" />
        <span className="ml-1">Flag</span>
      </Button>
    </div>
  );
}
