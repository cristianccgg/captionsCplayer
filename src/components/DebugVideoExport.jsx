import React, { useState } from "react";
import { Save } from "lucide-react";

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
    videoBitrate: 25000000, // Mantenemos el bitrate que funcionaba bien
    audioBitrate: 128000,
    subtitleOffset: 0,
    quality: "720p", // Nueva opción para calidad
  });

  // Definimos solo las dimensiones para cada calidad
  const resolutions = {
    "720p": {
      height: 720,
      videoBitrate: 25000000, // El bitrate que sabemos que funciona bien
      chunkInterval: 3500,
    },
    "1080p": {
      height: 1080,
      videoBitrate: 25000000, // Incrementado proporcionalmente
      chunkInterval: 5000,
    },
    "2k": {
      height: 1440,
      videoBitrate: 25000000,
      chunkInterval: 5500,
    },
    "4k": {
      height: 2160,
      videoBitrate: 55000000,
      chunkInterval: 6000,
    },
  };

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
      const clonedVideoElement = originalVideo.cloneNode(true);
      clonedVideoElement.muted = false;
      clonedVideoElement.currentTime = 0;

      await new Promise((resolve) => {
        clonedVideoElement.addEventListener("loadeddata", resolve, {
          once: true,
        });
        clonedVideoElement.load();
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });

      // Calcular dimensiones manteniendo aspect ratio
      const { videoWidth, videoHeight } = clonedVideoElement;
      const aspectRatio = videoWidth / videoHeight;
      const targetHeight = resolutions[debugOptions.quality].height;
      const targetWidth = Math.round(targetHeight * aspectRatio);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      console.log("Dimensiones del video:", targetWidth, "x", targetHeight);

      const videoStream = canvas.captureStream(
        debugOptions.reducedFPS ? 24 : 30
      );

      let audioContext;
      let combinedStream;

      if (debugOptions.includeAudio) {
        try {
          audioContext = new (window.AudioContext || window.webkitAudioContext)(
            {
              sampleRate: 44100,
              latencyHint: "playback",
            }
          );

          const source =
            audioContext.createMediaElementSource(clonedVideoElement);
          const destination = audioContext.createMediaStreamDestination();
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 1.0;

          source.connect(gainNode);
          gainNode.connect(destination);
          gainNode.connect(audioContext.destination);

          combinedStream = new MediaStream([
            ...videoStream.getTracks(),
            ...destination.stream.getTracks(),
          ]);
        } catch (error) {
          console.error("Error configurando audio:", error);
          combinedStream = videoStream;
        }
      } else {
        combinedStream = videoStream;
      }

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
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(chunks, { type: getMimeType() });
          setExportedVideoBlob(blob);
          setShowPreviewModal(true);
        } catch (error) {
          console.error("Error en mediaRecorder.onstop:", error);
        } finally {
          setIsExporting(false);
          setProgress(100);
        }
      };

      const render = () => {
        if (!isExporting) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(clonedVideoElement, 0, 0, canvas.width, canvas.height);

        if (debugOptions.includeSubtitles) {
          const currentTime =
            clonedVideoElement.currentTime + debugOptions.subtitleOffset;
          const currentPhrase = phrases.find(
            (phrase) =>
              currentTime * 1000 >= phrase.start &&
              currentTime * 1000 <= phrase.end
          );

          if (currentPhrase) {
            // Obtener estilos para esta frase
            const phraseStyles =
              subtitleStyles.phraseStyles?.[currentPhrase.id] ||
              subtitleStyles.default;

            // Configurar estilos de texto
            const scaledFontSize = Math.round(
              phraseStyles.fontSize * (canvas.height / 1080)
            );
            ctx.font = `${phraseStyles.fontWeight} ${
              phraseStyles.fontStyle
            } ${scaledFontSize}px ${phraseStyles.fontFamily || "Arial"}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Dividir texto en líneas
            const words = currentPhrase.text.split(" ");
            const lines = [];
            let currentLine = [];
            let currentLineWidth = 0;
            const maxWidth = canvas.width * 0.9;

            words.forEach((word) => {
              const wordWidth = ctx.measureText(word + " ").width;
              if (
                currentLineWidth + wordWidth > maxWidth &&
                currentLine.length > 0
              ) {
                lines.push(currentLine);
                currentLine = [word];
                currentLineWidth = wordWidth;
              } else {
                currentLine.push(word);
                currentLineWidth += wordWidth;
              }
            });

            if (currentLine.length > 0) {
              lines.push(currentLine);
            }

            // Calcular posición vertical
            const lineHeight = scaledFontSize * 1.2;
            const verticalPosition = phraseStyles.customPosition?.y
              ? phraseStyles.customPosition.y * canvas.height
              : canvas.height * 0.8;

            // Dibujar fondo si está habilitado
            if (phraseStyles.backgroundColor !== "transparent") {
              ctx.fillStyle = phraseStyles.backgroundColor;
              lines.forEach((line, lineIndex) => {
                const lineText = line.join(" ");
                const textWidth = ctx.measureText(lineText).width;
                const padding = 10;
                const lineVerticalPos =
                  verticalPosition +
                  (lineIndex - (lines.length - 1) / 2) * lineHeight;

                ctx.beginPath();
                ctx.roundRect(
                  canvas.width / 2 - textWidth / 2 - padding,
                  lineVerticalPos - scaledFontSize / 2 - padding / 2,
                  textWidth + padding * 2,
                  scaledFontSize + padding,
                  5
                );
                ctx.fill();
              });
            }

            // Dibujar texto
            lines.forEach((line, lineIndex) => {
              const lineText = line.join(" ");
              const lineVerticalPos =
                verticalPosition +
                (lineIndex - (lines.length - 1) / 2) * lineHeight;

              ctx.fillStyle = phraseStyles.color;
              ctx.fillText(lineText, canvas.width / 2, lineVerticalPos);
            });
          }
        }

        const currentProgress =
          (clonedVideoElement.currentTime / clonedVideoElement.duration) * 100;
        setProgress(Math.round(currentProgress));

        if (currentProgress >= 100) {
          mediaRecorder.stop();
          return;
        }

        requestAnimationFrame(render);
      };

      mediaRecorder.start(
        debugOptions.useFixedChunkSize ? debugOptions.chunkInterval : 250
      );
      await clonedVideoElement.play();
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
              {/* Quality Selection */}
              <div className="space-y-2">
                <h3 className="font-semibold text-white">Export Quality</h3>
                <select
                  value={debugOptions.quality}
                  onChange={(e) =>
                    setDebugOptions((prev) => ({
                      ...prev,
                      quality: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-700 text-white rounded px-2 py-1"
                >
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="2k">2K QHD</option>
                  <option value="4k">4K UHD</option>
                </select>
              </div>

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
                  <span>Reduce FPS</span>
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
              </div>

              {/* Advanced Options solo cuando sea necesario */}
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
