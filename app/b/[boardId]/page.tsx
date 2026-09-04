"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const Canvas = dynamic(() => import("../../../components/Canvas"), { ssr: false });

export default function BoardPage() {
  const params = useParams();
  const boardId = params.boardId as string;
  return <Canvas boardId={boardId} />;
}