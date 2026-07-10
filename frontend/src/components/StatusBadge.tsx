import type { DocumentStatus } from "../api/types";
import { DANGER_BADGE, INFO_BADGE, NEUTRAL_BADGE, SUCCESS_BADGE } from "../theme/badges";

const STYLES: Record<DocumentStatus, string> = {
  pending: NEUTRAL_BADGE,
  processing: INFO_BADGE,
  indexed: SUCCESS_BADGE,
  failed: DANGER_BADGE,
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
