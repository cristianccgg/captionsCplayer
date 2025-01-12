import React, { useEffect, useRef } from "react";
import { X, Download } from "lucide-react";

const isIOSMobile = () => {
  return (
    /iPad|iPhone|iPod/.test(navigator.platform) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1 &&
      !/Mac/.test(navigator.userAgent))
  );
};

const VideoPreviewModal = ({
  videoUrl,
  onClose,
  onDownload,
  filename,
  isOpen,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      // Forzar la carga del video cuando el modal se abre
      videoRef.current.load();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl">
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full"
            controls={true}
            playsInline
            controlsList="nodownload nofullscreen"
            preload="auto"
            onLoadedMetadata={(e) => {
              // Forzar la carga del video en iOS
              const video = e.target;
              video.load();
              if (isIOSMobile()) {
                video
                  .play()
                  .then(() => video.pause())
                  .catch(console.error);
              }
            }}
          />
        </div>

        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => {
              if (isIOSMobile()) {
                // Para iOS, usar un enfoque más compatible
                fetch(videoUrl)
                  .then((response) => response.blob())
                  .then((blob) => {
                    const iosBlob = new Blob([blob], {
                      type: "video/quicktime",
                    });
                    const url = URL.createObjectURL(iosBlob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename || "video.mov";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  })
                  .catch((error) => {
                    console.error("Error al procesar el video:", error);
                    alert("Error al procesar el video. Intente de nuevo.");
                  });
              } else {
                onDownload();
              }
            }}
            className="flex items-center gap-2 px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            <Download size={20} />
            Descargar
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPreviewModal;
