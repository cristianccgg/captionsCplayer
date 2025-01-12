import React, { useEffect } from "react";
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
  useEffect(() => {
    if (isOpen && videoUrl && isIOSMobile()) {
      // En iOS, necesitamos asegurarnos de que el blob se maneje correctamente
      fetch(videoUrl)
        .then((response) => response.blob())
        .then((blob) => {
          // Crear un nuevo blob con el tipo correcto para iOS
          const iosBlob = new Blob([blob], {
            type: "video/quicktime",
          });
          const iosUrl = URL.createObjectURL(iosBlob);

          // Crear y hacer clic en el enlace de descarga
          const a = document.createElement("a");
          a.href = iosUrl;
          a.download = filename || "video.mov"; // .mov es más compatible con iOS
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          // Limpiar
          setTimeout(() => {
            URL.revokeObjectURL(iosUrl);
            onClose();
          }, 100);
        })
        .catch((error) => {
          console.error("Error al procesar el video para iOS:", error);
          alert("Error al procesar el video. Por favor, intente de nuevo.");
        });
    }
  }, [isOpen, videoUrl]);

  // En iOS, no mostrar nuestro modal
  if (isIOSMobile()) return null;

  // En otros dispositivos, mostrar el modal normal
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl">
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
          <video
            src={videoUrl}
            className="w-full h-full"
            controls
            playsInline
            preload="auto"
          />
        </div>

        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={onDownload}
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
