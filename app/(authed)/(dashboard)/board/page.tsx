"use client";

import { Board } from "@/components/board/Board";
import { ListView } from "@/components/list/ListView";
import { useStore } from "@/lib/store";

export default function BoardPage() {
  const { boardViewMode } = useStore();
  return (
    <div key={boardViewMode} className="flex flex-1 flex-col animate-in fade-in duration-300">
      {boardViewMode === "list" ? <ListView /> : <Board />}
    </div>
  );
}
