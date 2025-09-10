"use client";
import AudioPlayer from "@/components/ui/AudioPlayer";
import { usePlayer } from "@/components/system/PlayerProvider";

export default function MiniPlayer() {
  const { current, next, prev, hasQueue } = usePlayer();
  if (!hasQueue || !current) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:inset-x-auto md:right-4 md:left-auto md:bottom-4">
      <div className="w-full md:w-[28rem] md:ml-auto">
        <AudioPlayer
          src={current.file}
          title={current.title}
          onEnd={next}
          onPrev={prev}
          onNext={next}
          mediaMeta={{
            artist: "Dead Internet Theory",
            album: "Dead Internet Theory",
            artwork: [{ src: "/images/IMG_8051.PNG", sizes: "512x512", type: "image/png" }],
          }}
          autoplayOnSrcChange
        />
      </div>
    </div>
  );
}
