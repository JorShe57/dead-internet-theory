# Images Folder

Place your UI images here. Files in this directory are served statically by Next.js and can be referenced with `/images/<filename>`.

Recommended subfolders:
- `covers/` – album art, cover images
- `artists/` – artist photos or avatars
- `ui/` – UI decorations, backgrounds, icons
- `qr/` – QR assets or related images

Usage in components:

```tsx
import Image from "next/image";

export default function Example() {
  return (
    <Image src="/images/ui/example.png" alt="Example" width={640} height={360} />
  );
}
```

Notes:
- Filenames should be lowercase, hyphen-separated.
- Prefer optimized formats (webp, avif) for performance.
- Keep large background images under `ui/` and consider responsive sizes.

