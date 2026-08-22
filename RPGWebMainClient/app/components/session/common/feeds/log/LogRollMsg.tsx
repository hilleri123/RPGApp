import { LogRoll } from "@/app/services/types/logmsg";
import { DataLogMsgProps } from "./DataLogMsgProps";

interface Props {
  msg: LogRoll;
}

function resolveSeedImageUrl(msg: LogRoll): string | null {
  const meta = msg.meta ?? {};
  const ref = typeof meta.seed_image_ref === "string" ? meta.seed_image_ref : null;
  if (ref) {
    const path = ref.startsWith("/") ? ref : `/${ref}`;
    if (path.startsWith("/media/")) return `/api${path}`;
    return `/api/media/${ref.replace(/^\//, "")}`;
  }
  const seed = msg.seed;
  if (seed && /^[a-f0-9]{16,64}$/i.test(seed)) {
    return `/api/media/rolls/${seed}.png`;
  }
  return null;
}

export function LogRollMsg(props: Props & DataLogMsgProps) {
  const users = [
    props.session.master,
    ...(props.session.players?.map((player) => player.user) ?? []),
  ];
  const userObj = users.find((u) => u.id === props.msg.user_id);
  const userName = userObj?.full_name ?? props.msg.user_id;

  const diceLabel = props.msg.dice?.length ? props.msg.dice.join(" + ") : "—";
  const totalPart = props.msg.total != null ? ` = ${props.msg.total}` : "";
  const declaration =
    typeof props.msg.meta?.declaration === "string"
      ? props.msg.meta.declaration.trim()
      : "";
  const seedUrl = resolveSeedImageUrl(props.msg);

  return (
    <span className="inline-flex flex-col gap-1 max-w-full">
      <span>
        <b>{userName}</b> бросил <b>{props.msg.title || "кубики"}</b>: {diceLabel}
        {totalPart}
        {props.msg.outcome ? ` (${props.msg.outcome})` : ""}
      </span>
      {declaration ? (
        <span className="text-white/50 text-[11px] whitespace-pre-wrap pl-1 border-l border-white/10">
          {declaration}
        </span>
      ) : null}
      {seedUrl ? (
        <img
          src={seedUrl}
          alt=""
          className="mt-1 max-w-[120px] max-h-[48px] rounded border border-white/10 object-contain bg-black/30"
          style={{ imageRendering: "pixelated" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}
