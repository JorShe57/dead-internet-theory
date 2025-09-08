"use client";
import { useCallback, useRef, useState, useEffect } from "react";
import { Camera, X } from "lucide-react";
import QrScanner from "qr-scanner";

type Props = {
  onResult: (text: string) => void;
};

export default function QRScanner({ onResult }: Props) {
  const [open, setOpen] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const hasHandledRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  const handleScan = useCallback(
    (result: string) => {
      if (!result || hasHandledRef.current) return;
      hasHandledRef.current = true;
      onResult(result);
      setOpen(false);
    },
    [onResult]
  );

  const handleError = useCallback((err: unknown) => {
    if (err) console.warn("QR error", err);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    hasHandledRef.current = false;
    if (qrScannerRef.current) {
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (open && videoRef.current && hasPermission !== false) {
      // Check camera permissions
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          setHasPermission(true);
          // Initialize QR scanner
          qrScannerRef.current = new QrScanner(
            videoRef.current!,
            (result) => {
              if (result && !hasHandledRef.current) {
                handleScan(result.data);
              }
            },
            {
              onDecodeError: (error) => {
                // Only log if it's not a common "not found" error
                if (error instanceof Error && !error.message.includes("No QR code found")) {
                  handleError(error);
                }
              },
              preferredCamera: "environment",
              highlightScanRegion: true,
              highlightCodeOutline: true,
            }
          );
          
          qrScannerRef.current.start().catch((error) => {
            console.warn("Failed to start QR scanner:", error);
            setHasPermission(false);
          });
        })
        .catch((error) => {
          console.warn("Camera permission denied:", error);
          setHasPermission(false);
        });
    }

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
    };
  }, [open, hasPermission, handleScan, handleError]);

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
              <button className="btn" onClick={handleClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
              {hasPermission === false ? (
                <div className="flex items-center justify-center h-full text-white">
                  <div className="text-center">
                    <Camera size={48} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Camera access required</p>
                    <p className="text-xs opacity-75">Please allow camera access to scan QR codes</p>
                  </div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}