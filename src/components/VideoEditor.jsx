import React, { useState, useRef, useEffect } from "react";
import {
  PlayCircle,
  PauseCircle,
  Video,
  Type,
  Rewind,
  FastForward,
  Square,
  Edit2,
  Trash2,
  Plus,
  ArrowLeftRight,
} from "lucide-react";

import { transcribeAudio } from "../services/transcriptionService";
import { SubtitleStyleControls } from "./SubtitleStyleControls";
import { VideoExport } from "./VideoExport";
import SubtitleRenderer from "./SubtitleRenderer";
import TranscriptionProgress from "./TranscriptionProgress";

export function VideoEditor() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [phrases, setPhrases] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [editingPhraseId, setEditingPhraseId] = useState(null);
  const [selectedPhraseIds, setSelectedPhraseIds] = useState([]);
  const [editingTime, setEditingTime] = useState(false);
  const [subtitleStyles, setSubtitleStyles] = useState({
    default: {
      fontSize: 16,
      fontWeight: 400,
      fontStyle: "normal",
      fontFamily: "system-ui, -apple-system, sans-serif", // Añadir esta línea
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      textAlign: "center",
      position: "bottom",
      textStroke: false,
      highlightColor: "#FBBF24",
      customPosition: null,
    },
    phraseStyles: {},
  });

  const [exportedVideoUrl, setExportedVideoUrl] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const editInputRef = useRef(null);

  const tracks = [
    { id: 1, type: "video", name: "Video Track" },
    { id: 2, type: "captions", name: "Subtítulos" },
  ];

  const [videoContainerRef, setVideoContainerRef] = useState(null);

  // Improved timeline seek function
  const handleTimelineSeek = (event) => {
    if (!timelineRef.current || !videoRef.current) return;

    const timeline = timelineRef.current;
    const rect = timeline.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;

    // Ensure we don't seek beyond video duration
    const timeInSeconds = Math.min(
      duration,
      Math.max(0, clickPosition / (50 * zoom))
    );

    videoRef.current.currentTime = timeInSeconds;
    setCurrentTime(timeInSeconds);
  };
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const calculateWordTiming = (phrase) => {
    const phraseLength = phrase.end - phrase.start;
    const words = phrase.text.split(" ");
    const timePerWord = phraseLength / words.length;

    return words.map((word, index) => ({
      word,
      start: phrase.start + timePerWord * index,
      end: phrase.start + timePerWord * (index + 1),
    }));
  };

  const [transcriptionProgress, setTranscriptionProgress] = useState(0);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
        }

        setPhrases([]);
        setTranscriptionProgress(0);
        setProcessingStatus("Preparando transcripción...");
        setVideoFile(file);
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        setIsTranscribing(true);

        // Simular progreso durante la carga
        const progressInterval = setInterval(() => {
          setTranscriptionProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 1000);

        const result = await transcribeAudio(file, (progress) => {
          setTranscriptionProgress(progress);
          switch (progress) {
            case 25:
              setProcessingStatus("En cola...");
              break;
            case 60:
              setProcessingStatus("Procesando audio...");
              break;
            case 100:
              setProcessingStatus("¡Transcripción completada!");
              break;
          }
        });

        if (result && result.phrases && result.phrases.length > 0) {
          clearInterval(progressInterval);
          setTranscriptionProgress(100);
          setPhrases(
            result.phrases.map((phrase, index) => ({
              ...phrase,
              id: `phrase-${index}`,
            }))
          );
          setProcessingStatus("¡Transcripción completada!");
        } else {
          throw new Error("No se detectaron palabras en el audio");
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setProcessingStatus("Error: " + error.message);
      } finally {
        setTimeout(() => {
          setIsTranscribing(false);
          setTranscriptionProgress(0);
        }, 1000);
      }
    }
  };

  // Opcional: limpiar la URL al desmontar el componente
  React.useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Función para manejar la selección
  const handlePhraseSelection = (id, event) => {
    if (event.ctrlKey || event.metaKey) {
      // Si se presiona Ctrl/Cmd, toggle la selección
      setSelectedPhraseIds((prev) =>
        prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
      );
    } else if (event.shiftKey && selectedPhraseIds.length > 0) {
      // Si se presiona Shift, seleccionar rango
      const lastSelected = selectedPhraseIds[selectedPhraseIds.length - 1];
      const currentIndex = phrases.findIndex((p) => p.id === id);
      const lastIndex = phrases.findIndex((p) => p.id === lastSelected);
      const start = Math.min(currentIndex, lastIndex);
      const end = Math.max(currentIndex, lastIndex);
      const newSelection = phrases.slice(start, end + 1).map((p) => p.id);
      setSelectedPhraseIds(newSelection);
    } else {
      // Click normal, selecciona solo este
      setSelectedPhraseIds([id]);
    }
  };

  const handlePhraseEdit = (id, newText) => {
    setPhrases((prevPhrases) =>
      prevPhrases.map((phrase) =>
        phrase.id === id ? { ...phrase, text: newText } : phrase
      )
    );
    setEditingPhraseId(null);
  };

  const handleTimeEdit = (id, type, newTime) => {
    setPhrases((prevPhrases) =>
      prevPhrases.map((phrase) => {
        if (phrase.id === id) {
          return {
            ...phrase,
            [type]: parseTimeToMs(newTime),
          };
        }
        return phrase;
      })
    );
  };

  const handleSplitPhrase = (id) => {
    const phraseIndex = phrases.findIndex((p) => p.id === id);
    const phrase = phrases[phraseIndex];
    const words = phrase.text.split(" ");

    if (words.length < 2) return;

    const midPoint = Math.floor(words.length / 2);
    const timePerWord = (phrase.end - phrase.start) / words.length;

    const firstHalf = {
      ...phrase,
      text: words.slice(0, midPoint).join(" "),
      end: phrase.start + timePerWord * midPoint,
    };

    const secondHalf = {
      ...phrase,
      id: `phrase-${Date.now()}`,
      text: words.slice(midPoint).join(" "),
      start: phrase.start + timePerWord * midPoint,
      end: phrase.end,
    };

    setPhrases((prevPhrases) => [
      ...prevPhrases.slice(0, phraseIndex),
      firstHalf,
      secondHalf,
      ...prevPhrases.slice(phraseIndex + 1),
    ]);
  };

  const handleMergePhrases = (id) => {
    const phraseIndex = phrases.findIndex((p) => p.id === id);
    if (phraseIndex === phrases.length - 1) return;

    const currentPhrase = phrases[phraseIndex];
    const nextPhrase = phrases[phraseIndex + 1];

    const mergedPhrase = {
      ...currentPhrase,
      text: `${currentPhrase.text} ${nextPhrase.text}`,
      end: nextPhrase.end,
    };

    setPhrases((prevPhrases) => [
      ...prevPhrases.slice(0, phraseIndex),
      mergedPhrase,
      ...prevPhrases.slice(phraseIndex + 2),
    ]);
  };

  const handleDeletePhrase = (id) => {
    setPhrases((prevPhrases) =>
      prevPhrases.filter((phrase) => phrase.id !== id)
    );
  };

  const getCurrentSubtitle = () => {
    const currentTimeMs = currentTime * 1000;
    const currentPhrase = phrases.find(
      (phrase) => currentTimeMs >= phrase.start && currentTimeMs <= phrase.end
    );
    return currentPhrase ? currentPhrase.text : "";
  };

  const formatTimeWithMs = (ms) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 1000);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  };

  const parseTimeToMs = (timeStr) => {
    const [minutesSeconds, ms] = timeStr.split(".");
    const [minutes, seconds] = minutesSeconds.split(":");
    return (
      parseInt(minutes) * 60 * 1000 +
      parseInt(seconds) * 1000 +
      parseInt(ms || 0)
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Container principal que cambia de dirección en breakpoint md */}
      <div className="flex flex-col md:flex-row flex-1">
        {/* Editor de Subtítulos */}
        <div className="flex-none md:w-1/3 bg-black border-t md:border-t-0 md:border-r border-gray-700 flex flex-col order-2 md:order-1">
          <div className="h-64 md:flex-1 p-4 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-white">
              Editor de Subtítulos
            </h3>
            <div className="space-y-2">
              {phrases.map((phrase) => (
                <div
                  key={phrase.id}
                  className={`group flex items-start gap-4 p-2 rounded hover:bg-gray-700 ${
                    selectedPhraseIds.includes(phrase.id) ? "bg-gray-700" : ""
                  }`}
                  onClick={(e) => handlePhraseSelection(phrase.id, e)}
                >
                  {/* Tiempo de inicio */}
                  <div className="flex-shrink-0 w-24 md:w-32">
                    {editingTime && selectedPhraseIds.includes(phrase.id) ? (
                      <input
                        type="text"
                        className="bg-gray-900 text-white px-2 py-1 rounded w-full"
                        defaultValue={formatTimeWithMs(phrase.start)}
                        onBlur={(e) =>
                          handleTimeEdit(phrase.id, "start", e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleTimeEdit(phrase.id, "start", e.target.value);
                            setEditingTime(false);
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="text-gray-400 cursor-pointer hover:text-white text-sm md:text-base"
                        onClick={() => setEditingTime(true)}
                      >
                        {formatTimeWithMs(phrase.start)}
                      </span>
                    )}
                  </div>

                  {/* Texto */}
                  <div className="flex-1">
                    {editingPhraseId === phrase.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="w-full bg-black text-white px-2 py-1 rounded"
                        defaultValue={phrase.text}
                        onBlur={(e) =>
                          handlePhraseEdit(phrase.id, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handlePhraseEdit(phrase.id, e.target.value);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <p className="text-white text-sm md:text-base">
                        {phrase.text}
                      </p>
                    )}
                  </div>

                  {/* Acciones - Ocultas en móvil por defecto, visibles al tocar */}
                  <div className="flex-shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingPhraseId(phrase.id)}
                      className="p-1 hover:bg-gray-600 rounded text-pink-600 hover:text-white"
                      title="Editar texto"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleSplitPhrase(phrase.id)}
                      className="p-1 hover:bg-gray-600 rounded text-pink-600 hover:text-white ml-1"
                      title="Dividir frase"
                    >
                      <ArrowLeftRight size={16} />
                    </button>
                    <button
                      onClick={() => handleMergePhrases(phrase.id)}
                      className="p-1 hover:bg-gray-600 rounded text-pink-600 hover:text-white ml-1"
                      title="Unir con siguiente"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => handleDeletePhrase(phrase.id)}
                      className="p-1 hover:bg-gray-600 rounded text-pink-600 hover:text-white ml-1"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <SubtitleStyleControls
            styles={
              selectedPhraseIds.length > 0
                ? subtitleStyles.phraseStyles[selectedPhraseIds[0]] ||
                  subtitleStyles.default
                : subtitleStyles.default
            }
            onStyleChange={(property, value) => {
              if (selectedPhraseIds.length > 0) {
                setSubtitleStyles((prev) => ({
                  ...prev,
                  phraseStyles: {
                    ...prev.phraseStyles,
                    ...Object.fromEntries(
                      selectedPhraseIds.map((id) => [
                        id,
                        {
                          ...(prev.phraseStyles[id] || prev.default),
                          [property]: value,
                        },
                      ])
                    ),
                  },
                }));
              } else {
                setSubtitleStyles((prev) => ({
                  ...prev,
                  default: {
                    ...prev.default,
                    [property]: value,
                  },
                }));
              }
            }}
            selectedPhraseIds={selectedPhraseIds}
          />
        </div>
        {/* Video Preview - Orden cambiado para móvil */}
        <div className="flex-none md:flex-1 flex flex-col order-1 md:order-2">
          <div className="h-64 md:h-full p-2 md:p-4 bg-black">
            <div className="h-full">
              <div className="relative w-full h-full bg-white rounded-lg overflow-hidden">
                {videoUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-contain"
                      onTimeUpdate={() =>
                        setCurrentTime(videoRef.current?.currentTime || 0)
                      }
                      onLoadedMetadata={(e) => {
                        setDuration(e.target.duration);
                      }}
                      playsInline // Forzar reproducción inline en iOS
                      webkit-playsinline="true" // Soporte para versiones antiguas de iOS
                      x5-playsinline="true" // Soporte para navegadores basados en X5
                      controlsList="nodownload nofullscreen noremoteplayback" // Prevenir controles nativos
                      disablePictureInPicture // Deshabilitar picture-in-picture
                      preload="auto" // Precargar el video
                    />
                    <TranscriptionProgress
                      isTranscribing={isTranscribing}
                      status={processingStatus}
                      progress={transcriptionProgress}
                    />
                    <div className="absolute inset-0">
                      {phrases.map((phrase) => {
                        const isPhraseVisible =
                          currentTime * 1000 >= phrase.start &&
                          currentTime * 1000 <= phrase.end;

                        if (!isPhraseVisible) return null;

                        const phraseStyles =
                          subtitleStyles.phraseStyles[phrase.id] ||
                          subtitleStyles.default;

                        const videoElement = videoRef.current;
                        const videoWidth = videoElement.videoWidth;
                        const videoHeight = videoElement.videoHeight;
                        const containerWidth = videoElement.clientWidth;
                        const containerHeight = videoElement.clientHeight;
                        const scale = Math.min(
                          containerWidth / videoWidth,
                          containerHeight / videoHeight
                        );

                        const scaledWidth = videoWidth * scale;
                        const scaledHeight = videoHeight * scale;

                        return (
                          <SubtitleRenderer
                            key={phrase.id}
                            phrase={phrase}
                            currentTime={currentTime}
                            styles={phraseStyles}
                            containerWidth={scaledWidth}
                            containerHeight={scaledHeight}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <label className="absolute inset-0 flex items-center justify-center text-gray-500 cursor-pointer">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="text-center">
                      <Video className="w-12 h-12 mx-auto mb-2" />
                      <p>Arrastra y suelta un video o haz clic para subir</p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          {videoUrl && (
            <VideoExport
              videoUrl={videoUrl}
              phrases={phrases}
              subtitleStyles={subtitleStyles}
              videoRef={videoRef}
            />
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="h-48 md:h-64 bg-black border-t border-gray-800 flex flex-col">
        {/* Controls */}
        <div className="flex items-center px-2 md:px-4 py-2 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (videoRef.current) {
                  const newTime = Math.max(
                    0,
                    videoRef.current.currentTime - 10
                  );
                  videoRef.current.currentTime = newTime;
                  setCurrentTime(newTime);
                }
              }}
              className="p-1 hover:bg-gray-800 rounded text-pink-600"
              disabled={!videoUrl}
              title="Rebobinar 10 segundos"
            >
              <Rewind size={20} />
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  if (isPlaying) {
                    videoRef.current.pause();
                  } else {
                    videoRef.current.play();
                  }
                  setIsPlaying(!isPlaying);
                }
              }}
              className="p-1 hover:bg-gray-800 rounded text-pink-600"
              disabled={!videoUrl}
            >
              {isPlaying ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  const newTime = Math.min(
                    duration,
                    videoRef.current.currentTime + 10
                  );
                  videoRef.current.currentTime = newTime;
                  setCurrentTime(newTime);
                }
              }}
              className="p-1 hover:bg-gray-800 rounded text-pink-600"
              disabled={!videoUrl}
              title="Adelantar 10 segundos"
            >
              <FastForward size={20} />
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.pause();
                  videoRef.current.currentTime = 0;
                  setIsPlaying(false);
                  setCurrentTime(0);
                }
              }}
              className="p-1 hover:bg-gray-800 rounded text-pink-600"
              disabled={!videoUrl}
              title="Detener"
            >
              <Square size={20} />
            </button>
          </div>

          <div className="ml-4 hidden md:block">
            <span className="text-sm font-mono text-white">
              {formatTimeWithMs(currentTime * 1000)} /{" "}
              {formatTimeWithMs(duration * 1000)}
            </span>
          </div>

          <div className="ml-auto flex items-center space-x-4">
            <span className="text-sm text-gray-400 hidden md:inline">
              {isTranscribing
                ? processingStatus
                : phrases.length > 0
                ? "¡Transcripción lista!"
                : ""}
            </span>
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="bg-black text-sm rounded border-none text-white"
            >
              <option value={0.5}>50%</option>
              <option value={1}>100%</option>
              <option value={1.5}>150%</option>
              <option value={2}>200%</option>
            </select>
          </div>
        </div>

        {/* Timeline tracks */}
        <div className="flex flex-1 overflow-hidden">
          {/* Track labels */}
          <div className="w-24 md:w-48 flex-shrink-0 bg-black border-r border-gray-800">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="h-16 flex items-center px-2 md:px-4 border-b border-gray-800"
              >
                {track.type === "video" && (
                  <Video size={16} className="mr-2 text-pink-600" />
                )}
                {track.type === "captions" && (
                  <Type size={16} className="mr-2 text-pink-600" />
                )}
                <span className="text-sm text-white">{track.name}</span>
              </div>
            ))}
          </div>

          {/* Timeline grid */}
          <div className="flex-1 overflow-x-scroll">
            <div
              ref={timelineRef}
              className="h-full relative cursor-pointer"
              style={{
                width: `${Math.max(duration * 50 * zoom, 800)}px`,
              }}
              onClick={handleTimelineSeek}
            >
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="h-16 border-b border-gray-800 relative"
                >
                  {track.type === "video" && videoUrl && (
                    <div
                      className="absolute h-full bg-pink-500 bg-opacity-20 border-l border-r border-gray-500"
                      style={{
                        left: 0,
                        width: `${duration * 50 * zoom}px`,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-white truncate px-2">
                          Video Track
                        </span>
                      </div>
                    </div>
                  )}

                  {track.type === "captions" &&
                    phrases.map((phrase) => (
                      <div
                        key={phrase.id}
                        className={`absolute h-full bg-blue-500 bg-opacity-20 border-l border-r border-blue-500 hover:bg-opacity-30 cursor-pointer ${
                          selectedPhraseIds.includes(phrase.id)
                            ? "bg-opacity-40"
                            : ""
                        }`}
                        style={{
                          left: `${(phrase.start / 1000) * 50 * zoom}px`,
                          width: `${
                            ((phrase.end - phrase.start) / 1000) * 50 * zoom
                          }px`,
                        }}
                        onClick={(e) => {
                          handlePhraseSelection(phrase.id, e);
                          if (videoRef.current) {
                            videoRef.current.currentTime = phrase.start / 1000;
                          }
                        }}
                        title={phrase.text}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-white truncate px-2">
                            {phrase.text}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-pink-500"
                style={{ left: `${currentTime * 50 * zoom}px` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoEditor;
