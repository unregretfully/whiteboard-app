"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function createBoard() {
      const { data } = await supabase.from("boards").insert({}).select().single();
      if (data) {
        router.replace(`/b/${data.id}`);
      }
    }
    createBoard();
  }, [router]);

  return <div>Creating your board...</div>;
}