import React, { useState } from "react";
import { Save, Check } from "lucide-react";

const DebugVideoExport = ({
  videoUrl,
  phrases,
  subtitleStyles,
  videoRef: mainVideoRef,
}) => {
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugOptions, setDebugOptions] = useState({
    includeAudio: true,
    includeSubtitles: true,
    reducedFPS: false,
    reducedBitrate: false,
    useFixedChunkSize: true,
    chunkInterval: 1000,
    videoBitrate: 2500000,
    audioBitrate: 128000,
    subtitleOffset: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [exportedVideoBlob, setExportedVideoBlob] = useState(null);

  const getMimeType = () => {
    const mimeTypes = [
      "video/mp4;codecs=h264",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp9",
      "video/webm",
      "video/mp4",
    ];

    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log("Usando MIME type:", type);
        return type;
      }
    }
    throw new Error("No supported MIME type found");
  };

  const startDebugExport = async () => {
    try {
      setIsExporting(true);
      setProgress(0);

      const originalVideo = mainVideoRef.current;

      // Create canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });

      // Set dimensions (using 720p for testing)
      const { videoWidth, videoHeight } = originalVideo;
      const aspectRatio = videoWidth / videoHeight;
      const targetHeight = 720;
      const targetWidth = Math.round(targetHeight * aspectRatio);
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Setup video stream first
      console.log("Configurando video stream...");
      const videoStream = canvas.captureStream(
        debugOptions.reducedFPS ? 24 : 30
      );
      console.log("Video stream configurado");

      // Setup audio context and streams
      let audioContext;
      let combinedStream;

      if (debugOptions.includeAudio) {
        try {
          console.log("Configurando audio...");
          audioContext = new (window.AudioContext || window.webkitAudioContext)(
            {
              sampleRate: 44100,
              latencyHint: "playback",
            }
          );

          const source = audioContext.createMediaElementSource(originalVideo);
          const destination = audioContext.createMediaStreamDestination();

          // Añadir un gainNode para control de volumen
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 1.0;

          source.connect(gainNode);
          gainNode.connect(destination);
          gainNode.connect(audioContext.destination);

          console.log("Audio configurado correctamente");

          combinedStream = new MediaStream([
            ...videoStream.getTracks(),
            ...destination.stream.getTracks(),
          ]);
        } catch (error) {
          console.error("Error configurando audio:", error);
          // Si hay error con el audio, continuar solo con video
          combinedStream = videoStream;
        }
      } else {
        console.log("Exportando sin audio...");
        combinedStream = videoStream;
      }

      // Configure MediaRecorder
      const options = {
        mimeType: getMimeType(),
        videoBitsPerSecond: debugOptions.reducedBitrate
          ? debugOptions.videoBitrate / 2
          : debugOptions.videoBitrate,
        audioBitsPerSecond: debugOptions.includeAudio
          ? debugOptions.audioBitrate
          : undefined,
      };

      const mediaRecorder = new MediaRecorder(combinedStream, options);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          const chunkSizeMB = (e.data.size / (1024 * 1024)).toFixed(2);
          console.log(
            `Chunk recibido: ${chunkSizeMB}MB - Total chunks: ${chunks.length}`
          );

          // Monitorear el progreso y el estado del MediaRecorder
          const currentProgress =
            (originalVideo.currentTime / originalVideo.duration) * 100;
          console.log(
            `Progreso: ${currentProgress.toFixed(1)}% - Estado MediaRecorder: ${
              mediaRecorder.state
            }`
          );
        }
      };

      mediaRecorder.onstop = () => {
        try {
          console.log("Chunks recibidos:", chunks.length);
          const mimeType = getMimeType();
          const blob = new Blob(chunks, { type: mimeType });
          console.log("Blob creado:", blob.size, "bytes");

          if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
            console.log("Dispositivo iOS detectado, mostrando preview");
            setExportedVideoBlob(blob);
            setShowPreviewModal(true);
          } else {
            console.log("Dispositivo no-iOS, descargando directamente");
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `debug_video_export_${Date.now()}.${
              mimeType.includes("webm") ? "webm" : "mp4"
            }`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } catch (error) {
          console.error("Error en mediaRecorder.onstop:", error);
        } finally {
          setIsExporting(false);
          setProgress(100);
        }
      };

      // Start recording with configured interval
      try {
        const chunkInterval = debugOptions.useFixedChunkSize
          ? debugOptions.chunkInterval
          : 250;
        console.log("Iniciando grabación...");
        console.log("Intervalo de chunks:", chunkInterval, "ms");
        console.log("Video bitrate:", options.videoBitsPerSecond);
        console.log("Audio bitrate:", options.audioBitsPerSecond);

        // Asegurarse de que el video esté pausado y en el inicio
        originalVideo.currentTime = 0;
        originalVideo.pause();

        mediaRecorder.start(chunkInterval);
        console.log("MediaRecorder iniciado correctamente");

        // Pequeño retraso antes de iniciar la reproducción
        setTimeout(async () => {
          try {
            await originalVideo.play();
            console.log("Reproducción iniciada");
          } catch (playError) {
            console.error("Error iniciando reproducción:", playError);
            mediaRecorder.stop();
            setIsExporting(false);
          }
        }, 100);
      } catch (startError) {
        console.error("Error iniciando grabación:", startError);
        setIsExporting(false);
      }

      // Render loop
      const render = () => {
        if (!isExporting) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(originalVideo, 0, 0, canvas.width, canvas.height);

        if (debugOptions.includeSubtitles) {
          const currentTime =
            originalVideo.currentTime + debugOptions.subtitleOffset;
          if (typeof subtitleStyles?.drawSubtitles === "function") {
            subtitleStyles.drawSubtitles(ctx, canvas, currentTime, phrases);
          }
        }

        const currentProgress =
          (originalVideo.currentTime / originalVideo.duration) * 100;
        setProgress(Math.round(currentProgress));

        if (currentProgress >= 100) {
          mediaRecorder.stop();
          return;
        }

        requestAnimationFrame(render);
      };

      requestAnimationFrame(render);
    } catch (error) {
      console.error("Debug export error:", error);
      setIsExporting(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <button
        onClick={() => setShowDebugModal(true)}
        className="inline-flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
      >
        <Save className="w-4 h-4 mr-2" />
        <span>Debug Export</span>
      </button>

      {showDebugModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-white">
              Debug Export Options
            </h2>

            <div className="space-y-4">
              {/* Basic Options */}
              <div className="space-y-2">
                <h3 className="font-semibold text-white">Basic Options</h3>
                <label className="flex items-center justify-between text-white">
                  <span>Include Audio</span>
                  <input
                    type="checkbox"
                    checked={debugOptions.includeAudio}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        includeAudio: e.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between text-white">
                  <span>Include Subtitles</span>
                  <input
                    type="checkbox"
                    checked={debugOptions.includeSubtitles}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        includeSubtitles: e.target.checked,
                      }))
                    }
                  />
                </label>
              </div>

              {/* Performance Options */}
              <div className="space-y-2">
                <h3 className="font-semibold text-white">Performance</h3>
                <label className="flex items-center justify-between text-white">
                  <span>Reduce FPS (24 instead of 30)</span>
                  <input
                    type="checkbox"
                    checked={debugOptions.reducedFPS}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        reducedFPS: e.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between text-white">
                  <span>Reduce Bitrate</span>
                  <input
                    type="checkbox"
                    checked={debugOptions.reducedBitrate}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        reducedBitrate: e.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between text-white">
                  <span>Use Fixed Chunk Size</span>
                  <input
                    type="checkbox"
                    checked={debugOptions.useFixedChunkSize}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        useFixedChunkSize: e.target.checked,
                      }))
                    }
                  />
                </label>
              </div>

              {/* Advanced Options */}
              <div className="space-y-2">
                <h3 className="font-semibold text-white">Advanced Options</h3>

                <label className="block text-white">
                  <span>Chunk Interval (ms)</span>
                  <input
                    type="number"
                    min="100"
                    max="2000"
                    step="100"
                    value={debugOptions.chunkInterval}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        chunkInterval: parseInt(e.target.value),
                      }))
                    }
                    className="w-full mt-1 bg-gray-700 text-white rounded px-2 py-1"
                  />
                </label>

                <label className="block text-white">
                  <span>Video Bitrate (bps)</span>
                  <input
                    type="number"
                    min="1000000"
                    max="8000000"
                    step="500000"
                    value={debugOptions.videoBitrate}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        videoBitrate: parseInt(e.target.value),
                      }))
                    }
                    className="w-full mt-1 bg-gray-700 text-white rounded px-2 py-1"
                  />
                </label>

                <label className="block text-white">
                  <span>Audio Bitrate (bps)</span>
                  <input
                    type="number"
                    min="64000"
                    max="256000"
                    step="32000"
                    value={debugOptions.audioBitrate}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        audioBitrate: parseInt(e.target.value),
                      }))
                    }
                    className="w-full mt-1 bg-gray-700 text-white rounded px-2 py-1"
                  />
                </label>
              </div>

              {debugOptions.includeSubtitles && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-white">Subtitle Options</h3>
                  <label className="block text-white">
                    Subtitle Offset (seconds)
                  </label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={debugOptions.subtitleOffset}
                    onChange={(e) =>
                      setDebugOptions((prev) => ({
                        ...prev,
                        subtitleOffset: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <span className="text-white">
                    {debugOptions.subtitleOffset}s
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowDebugModal(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDebugModal(false);
                  startDebugExport();
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Start Debug Export
              </button>
            </div>
          </div>
        </div>
      )}

      {isExporting && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-center mt-2">{Math.round(progress)}%</p>
        </div>
      )}

      {showPreviewModal && exportedVideoBlob && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-lg">
            <div className="p-4">
              <h3 className="text-lg font-bold text-white">
                Debug Export Preview
              </h3>
            </div>
            <video
              src={URL.createObjectURL(exportedVideoBlob)}
              controls
              className="w-full"
            />
            <div className="p-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setExportedVideoBlob(null);
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const url = URL.createObjectURL(exportedVideoBlob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `debug_video_export_${Date.now()}.mp4`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugVideoExport;
