"use client";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  className?: string;
};

export default function GlitchText({ text, className }: Props) {
  return (
    <h1
      data-text={text}
      className={cn("glitch select-none tracking-widest", className)}
    >
      {text}
    </h1>
  );
}
