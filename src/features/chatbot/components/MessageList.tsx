import { useEffect, useRef } from "react";
import type { LogEntry, PendingFileAttachment } from "../types";
import MessageBubble from "./MessageBubble";
import LoadingBubble from "./LoadingBubble";
import {
  ActionHistoryCard,
  AoiOfferCard,
  BoundaryDownloadCard,
  ChoiceCard,
  ConfirmActionCard,
  GuideStepCard,
  RetryChip,
  WarningsBlock,
} from "./cards";

interface Props {
  log: LogEntry[];
  onCancelLoading: () => void;
  onRetryLoading: (message: string, image: string | null, file: PendingFileAttachment | null) => void;
  onRetryChip: (entryId: string) => void;
  onRunConfirm: (entryId: string) => void;
  onCancelConfirm: (entryId: string) => void;
  onSelectChoice: (entryId: string, index: number) => void;
  onResolveAoiOffer: (entryId: string, choice: "set" | "send") => void;
}

/** Scrollable chat log - renders each LogEntry via its kind, keeping insertion order. */
export default function MessageList({
  log,
  onCancelLoading,
  onRetryLoading,
  onRetryChip,
  onRunConfirm,
  onCancelConfirm,
  onSelectChoice,
  onResolveAoiOffer,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <div id="sgc-messages" ref={containerRef}>
      {log.map((entry) => {
        switch (entry.kind) {
          case "message":
            return (
              <MessageBubble
                key={entry.id}
                role={entry.role}
                text={entry.text}
                image={entry.image}
                file={entry.file}
              />
            );
          case "loading":
            return (
              <LoadingBubble
                key={entry.id}
                startedAt={entry.startedAt}
                onCancel={onCancelLoading}
                onRetry={() => onRetryLoading(entry.message, entry.image, entry.file)}
              />
            );
          case "warnings":
            return <WarningsBlock key={entry.id} warnings={entry.warnings} />;
          case "actionHistory":
            return <ActionHistoryCard key={entry.id} actions={entry.actions} timestamp={entry.timestamp} />;
          case "confirmCard":
            return (
              <ConfirmActionCard
                key={entry.id}
                actions={entry.actions}
                status={entry.status}
                runningStepIndex={entry.runningStepIndex}
                onRun={() => onRunConfirm(entry.id)}
                onCancel={() => onCancelConfirm(entry.id)}
              />
            );
          case "choiceCard":
            return (
              <ChoiceCard
                key={entry.id}
                question={entry.question}
                choices={entry.choices}
                selectedIndex={entry.selectedIndex}
                onSelect={(index) => onSelectChoice(entry.id, index)}
              />
            );
          case "guideStep":
            return (
              <GuideStepCard key={entry.id} step={entry.step} total={entry.total} title={entry.title} body={entry.body} />
            );
          case "aoiOffer":
            return (
              <AoiOfferCard
                key={entry.id}
                fileName={entry.fileName}
                name={entry.name}
                sizeLabel={entry.sizeLabel}
                resolved={entry.resolved}
                onSet={() => onResolveAoiOffer(entry.id, "set")}
                onSend={() => onResolveAoiOffer(entry.id, "send")}
              />
            );
          case "retryChip":
            return (
              <RetryChip key={entry.id} cancelNote={entry.cancelNote} onRetry={() => onRetryChip(entry.id)} />
            );
          case "boundaryDownload":
            return (
              <BoundaryDownloadCard
                key={entry.id}
                name={entry.name}
                downloadUrl={entry.downloadUrl}
                filename={entry.filename}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
