"use client";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Camera, X } from "lucide-react";
import type { CSSProperties } from "react";

type QrReaderResult = { text?: string } | null;
type QrReaderProps = {
  constraints?: MediaTrackConstraints;
  onResult?: (result: QrReaderResult, error: Error | null) => void;
  containerStyle?: CSSProperties;
};

const QrReader = dynamic<QrReaderProps>(
  () =>
    import("react-qr-reader").then((m) =>
      (m as unknown as { QrReader: React.ComponentType<QrReaderProps> }).QrReader
    ),
  { ssr: false, loading: () => null }
);

type Props = {
  onResult: (text: string) => void;
};

export default function QRScanner({ onResult }: Props) {
  const [open, setOpen] = useState(false);

  const handleScan = useCallback(
    (result: QrReaderResult) => {
      if (!result) return;
      const text = typeof result === "string" ? result : result?.text;
      if (text) {
        onResult(text);
        setOpen(false);
      }
    },
    [onResult]
  );

  const handleError = useCallback((err: Error | null) => {
    if (err) console.warn("QR error", err);
  }, []);

  return (
    <div>
      {!open ? (
        <button className="btn inline-flex items-center gap-2" onClick={() => setOpen(true)}>
          <Camera size={16} /> Scan QR
        </button>
      ) : (
        <div className="fixed inset-0 bg-background/90 z-50 p-4">
          <div className="mx-auto max-w-md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-accent">Scan care package QR</div>
              <button className="btn" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <QrReader
              constraints={{ facingMode: "environment" }}
              onResult={(res, err) => {
                if (res) handleScan(res);
                if (err) handleError(err);
              }}
              containerStyle={{ width: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
