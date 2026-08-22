
import { SessionFeedsTabs } from "../common/SessionFeedsTabs";

interface PlayerLogTabProps {
  sessionId: string;
}

export default function PlayerLogTab({ sessionId }: PlayerLogTabProps) {
  return (
    <div className="flex flex-col min-h-0 h-full px-1">
      <h2 className="shrink-0 font-semibold text-sm mb-2 text-white">История</h2>
      <div className="flex-1 min-h-0">
        <SessionFeedsTabs sessionId={sessionId} fillAvailable />
      </div>
    </div>
  );
}
