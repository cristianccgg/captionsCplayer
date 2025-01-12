import React, { useEffect, useRef } from "react";
import { X, Download } from "lucide-react";

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
        {/* Video con controles nativos ocultos pero manteniendo la funcionalidad */}
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full"
            controls={true}
            playsInline
            preload="auto"
            controlsList="nodownload nofullscreen"
            onLoadedMetadata={(e) => {
              // Forzar la carga del video en iOS
              const video = e.target;
              video.load();
              // En iOS, reproducir brevemente y pausar ayuda a inicializar el reproductor
              if (/iPad|iPhone|iPod/.test(navigator.platform)) {
                video
                  .play()
                  .then(() => video.pause())
                  .catch(console.error);
              }
            }}
          />
        </div>

        {/* Botones personalizados */}
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
