# Videos Folder

Place your videos here. Files in this directory are served statically by Next.js and can be referenced with `/videos/<filename>`.

Recommended formats: `mp4 (H.264/AAC)`, `webm (VP9/Opus)`, `ogg`.

Example usage in a component:

```tsx
export default function Clip() {
  return (
    <video
      src="/videos/sample.mp4"
      controls
      preload="metadata"
      className="w-full rounded"
    />
  );
}
```

Tips:
- Keep files reasonably sized; consider multiple resolutions.
- Use `preload="metadata"` so the browser doesn’t fetch the entire file immediately.
- For mobile autoplay, set `muted` and `playsInline`.
- You can also provide `<source>` elements for multiple formats.
