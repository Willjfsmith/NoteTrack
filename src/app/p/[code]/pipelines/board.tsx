"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { moveItem } from "@/lib/pipelines/move-item";
import type { BoardCard, BoardData } from "@/lib/pipelines/fetch-board";

export function Board({ initial, projectCode }: { initial: BoardData; projectCode: string }) {
  const [data, setData] = useState<BoardData>(initial);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(e: DragEndEvent) {
    const fromStageId = e.active.data.current?.stageId as string | undefined;
    const toStageId = e.over?.id as string | undefined;
    const itemId = String(e.active.id);
    if (!fromStageId || !toStageId || fromStageId === toStageId) return;

    // Optimistic swap.
    setData((prev) => {
      const stages = prev.stages.map((s) => ({ ...s, cards: [...s.cards] }));
      const from = stages.find((s) => s.id === fromStageId);
      const to = stages.find((s) => s.id === toStageId);
      if (!from || !to) return prev;
      const idx = from.cards.findIndex((c) => c.id === itemId);
      if (idx < 0) return prev;
      const [card] = from.cards.splice(idx, 1);
      to.cards.unshift({ ...card, current_stage_id: to.id, daysInStage: 0, late: false });
      from.count = from.cards.length;
      to.count = to.cards.length;
      return { ...prev, stages };
    });

    startTransition(async () => {
      const res = await moveItem({ itemId, toStageId });
      if (!res.ok) {
        toast.error(res.error);
        // Roll back by reverting locally — simplest = re-run the same swap in reverse.
        setData((prev) => {
          const stages = prev.stages.map((s) => ({ ...s, cards: [...s.cards] }));
          const to = stages.find((s) => s.id === toStageId);
          const from = stages.find((s) => s.id === fromStageId);
          if (!from || !to) return prev;
          const idx = to.cards.findIndex((c) => c.id === itemId);
          if (idx < 0) return prev;
          const [card] = to.cards.splice(idx, 1);
          from.cards.unshift({ ...card, current_stage_id: from.id });
          from.count = from.cards.length;
          to.count = to.cards.length;
          return { ...prev, stages };
        });
        return;
      }
      if (!res.noop) toast.success("Moved.");
    });
  }

  if (data.stages.length === 0) {
    return (
      <div className="rounded-4 border border-dashed border-line p-12 text-center text-ink-3">
        <p>This project has no pipeline yet.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className={cn("flex h-full gap-3 overflow-x-auto p-1 pb-4", pending && "opacity-95")}>
        {data.stages.map((stage) => (
          <Column key={stage.id} stage={stage} projectCode={projectCode} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  stage,
  projectCode,
}: {
  stage: BoardData["stages"][number];
  projectCode: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] flex-none flex-col rounded-3 border border-line bg-bg-2 transition-colors",
        isOver && "border-accent ring-1 ring-accent",
      )}
    >
      <div className="flex items-center gap-1.5 rounded-t-3 border-b border-line bg-surface px-3 py-2.5">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink">
          {stage.name}
        </span>
        <span className="ml-auto rounded border border-line bg-bg-2 px-1 font-mono text-[10.5px] text-ink-3">
          {stage.count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {stage.cards.length === 0 && (
          <div className="rounded-2 border border-dashed border-line py-6 text-center text-[11px] text-ink-4">
            drop here
          </div>
        )}
        {stage.cards.map((card) => (
          <Card key={card.id} card={card} stageId={stage.id} projectCode={projectCode} />
        ))}
      </div>
    </div>
  );
}

function Card({
  card,
  stageId,
  projectCode,
}: {
  card: BoardCard;
  stageId: string;
  projectCode: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { stageId },
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        transition: "transform 150ms cubic-bezier(.2,.8,.2,1)",
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-2 border bg-surface p-2.5 text-[12px] shadow-1 transition-colors",
        card.late ? "border-tone-red-bd bg-tone-red-bg/40" : "border-line hover:border-line-3",
        isDragging && "opacity-50",
      )}
    >
      <a
        href={`/p/${projectCode}/items/${card.ref_code}`}
        className="font-medium leading-tight text-ink hover:underline"
        onClick={(e) => isDragging && e.preventDefault()}
      >
        {card.title}
      </a>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-ink-3">
        <span className="font-mono">#{card.ref_code}</span>
        <span className="ml-auto" />
        {card.late && (
          <span className="rounded-1 border border-tone-red-bd bg-tone-red-bg px-1 font-mono uppercase text-tone-red-ink">
            late
          </span>
        )}
        <span className="font-mono">
          {card.daysInStage === 0 ? "today" : `${card.daysInStage}d`}
        </span>
      </div>
    </div>
  );
}
