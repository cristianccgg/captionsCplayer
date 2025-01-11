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
import EditorControls from "./EditorControls";
import { LanguageSelectionModal } from "./LanguageSelectionModal";

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
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("auto");

  const [subtitleStyles, setSubtitleStyles] = useState({
    default: {
      fontSize: 36,
      fontFamily: "'Inter', sans-serif",
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      position: "bottom",
      highlightColor: "#FFFFFF",
      fontWeight: 400,
      fontStyle: "normal",
      textAlign: "center",
      textStroke: false,
      customPosition: {
        y: 0.8,
      },
    },
    phraseStyles: {}, // Mantener este objeto vacío inicialmente
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [videoContainerStyle, setVideoContainerStyle] = useState({
    width: "100%",
    height: "100%",
    position: "relative",
  });

  const handleAspectRatioChange = (newRatio) => {
    setAspectRatio(newRatio);

    if (!videoContainerRef.current || !videoRef.current) return;

    const container = videoContainerRef.current;
    const containerWidth = container.offsetWidth;
    // Establecer un máximo de altura basado en el viewport
    const maxHeight = window.innerHeight * 0.6; // 60% del viewport

    let newHeight;
    switch (newRatio) {
      case "9:16": // Shorts
        newHeight = Math.min((containerWidth * 16) / 9, maxHeight);
        break;
      case "1:1": // Square
        newHeight = Math.min(containerWidth, maxHeight);
        break;
      default: // 16:9
        newHeight = Math.min((containerWidth * 9) / 16, maxHeight);
    }

    setVideoContainerStyle({
      width: "100%",
      height: `${newHeight}px`,
      position: "relative",
    });
  };

  const handleStyleChange = (newStyle) => {
    setSubtitleStyles((prev) => {
      const updatedStyles = { ...prev };

      // Actualizar estilo por defecto
      updatedStyles.default = {
        ...updatedStyles.default,
        ...newStyle,
      };

      // Solo aplicar preset a frases seleccionadas
      if (selectedPhraseIds.length > 0) {
        selectedPhraseIds.forEach((id) => {
          updatedStyles.phraseStyles[id] = {
            ...updatedStyles.default,
            ...newStyle,
          };
        });
      }

      return updatedStyles;
    });
  };

  // Efecto para manejar atajos de teclado
  useEffect(() => {
    const handleKeyPress = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === " ") {
        e.preventDefault();
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause();
          } else {
            videoRef.current.play();
          }
          setIsPlaying(!isPlaying);
        }
      }

      if (modKey && e.key === "z") {
        e.preventDefault();
        // Implementar lógica de undo aquí
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (videoRef.current) {
          const newTime = Math.max(
            0,
            videoRef.current.currentTime - (e.shiftKey ? 10 : 5)
          );
          videoRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        }
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (videoRef.current) {
          const newTime = Math.min(
            duration,
            videoRef.current.currentTime + (e.shiftKey ? 10 : 5)
          );
          videoRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isPlaying, duration]);

  // Función para manejar el inicio del arrastre
  const handleTimelineMouseDown = (e) => {
    if (!timelineRef.current) return;

    const timeline = timelineRef.current;
    const rect = timeline.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / (50 * zoom);

    setIsDragging(true);
    setDragStart(startX);
    setDragEnd(startX);

    // Si no se está presionando Cmd/Ctrl, limpiar la selección previa
    if (!e.metaKey && !e.ctrlKey) {
      setSelectedPhraseIds([]);
    }
  };

  // Función para manejar el movimiento durante el arrastre
  const handleTimelineMouseMove = (e) => {
    if (!isDragging || !timelineRef.current) return;

    const timeline = timelineRef.current;
    const rect = timeline.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / (50 * zoom);

    setDragEnd(currentX);

    // Seleccionar frases que están dentro del rango de arrastre
    const start = Math.min(dragStart, currentX);
    const end = Math.max(dragStart, currentX);

    const selectedPhrases = phrases.filter((phrase) => {
      const phraseStart = phrase.start / 1000;
      const phraseEnd = phrase.end / 1000;
      return (
        (phraseStart >= start && phraseStart <= end) ||
        (phraseEnd >= start && phraseEnd <= end) ||
        (phraseStart <= start && phraseEnd >= end)
      );
    });

    const newSelectedIds = selectedPhrases.map((phrase) => phrase.id);

    // Si se está presionando Cmd/Ctrl, agregar a la selección existente
    if (e.metaKey || e.ctrlKey) {
      setSelectedPhraseIds((prev) => [
        ...new Set([...prev, ...newSelectedIds]),
      ]);
    } else {
      setSelectedPhraseIds(newSelectedIds);
    }
  };

  // Función para manejar el fin del arrastre
  const handleTimelineMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  // Renderizar el área de selección en el timeline
  const renderSelectionArea = () => {
    if (!isDragging || dragStart === null || dragEnd === null) return null;

    const left = Math.min(dragStart, dragEnd) * 50 * zoom;
    const width = Math.abs(dragEnd - dragStart) * 50 * zoom;

    return (
      <div
        className="absolute top-0 bottom-0 bg-pink-500 bg-opacity-20 pointer-events-none border border-pink-500 border-opacity-50"
        style={{
          left: `${left}px`,
          width: `${width}px`,
        }}
      />
    );
  };

  useEffect(() => {
    // Cargar Bebas Neue de Google Fonts
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    // Cleanup al desmontar el componente
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const isMacOS = () => {
    return (
      navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
      navigator.userAgent.toUpperCase().indexOf("MAC") >= 0
    );
  };

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

  const videoContainerRef = useRef(null);

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

  const [transcriptionProgress, setTranscriptionProgress] = useState(0);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Guardar el archivo y abrir modal de selección de idioma
      setSelectedFile(file);
      setIsLanguageModalOpen(true);
    }
  };

  const handleLanguageSelect = async (language) => {
    if (selectedFile) {
      try {
        // Limpiar estado previo
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
        }
        setPhrases([]);
        setTranscriptionProgress(0);
        setProcessingStatus("Preparando transcripción...");

        // Configurar archivo y URL de video
        setVideoFile(selectedFile);
        const url = URL.createObjectURL(selectedFile);
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

        // Transcribir con el idioma seleccionado
        const result = await transcribeAudio(
          selectedFile,
          (progress) => {
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
          },
          { languageCode: language }
        ); // Pasar idioma seleccionado

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
        setIsLanguageModalOpen(false); // Cerrar modal
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

  const handlePhraseEdit = (id, newText, splitPosition = null) => {
    // Si hay una posición de división manual (Alt+Enter)
    if (splitPosition !== null && splitPosition > 0) {
      const firstPart = newText.slice(0, splitPosition);
      const secondPart = newText.slice(splitPosition);

      setPhrases((prevPhrases) => {
        const originalPhrase = prevPhrases.find((p) => p.id === id);
        const totalDuration = originalPhrase.end - originalPhrase.start;

        // Calcula el tiempo de división basado en la posición del cursor
        const splitTime =
          originalPhrase.start +
          totalDuration * (splitPosition / newText.length);

        const newPhrases = [
          {
            ...originalPhrase,
            text: firstPart.trim(),
            start: originalPhrase.start,
            end: splitTime,
          },
          {
            ...originalPhrase,
            id: `phrase-${Date.now()}`,
            text: secondPart.trim(),
            start: splitTime,
            end: originalPhrase.end,
          },
        ];

        return [...prevPhrases.filter((p) => p.id !== id), ...newPhrases].sort(
          (a, b) => a.start - b.start
        );
      });

      setEditingPhraseId(null);
      return;
    }

    // Comportamiento para puntos
    if (newText.includes(".")) {
      const segments = newText.split(".").filter((text) => text.trim());

      if (segments.length > 1) {
        setPhrases((prevPhrases) => {
          const originalPhrase = prevPhrases.find((p) => p.id === id);
          const totalDuration = originalPhrase.end - originalPhrase.start;
          const segmentDuration = totalDuration / segments.length;

          const newPhrases = segments.map((text, index) => ({
            ...originalPhrase,
            id: index === 0 ? id : `phrase-${Date.now()}-${index}`,
            text: text.trim() + (index < segments.length - 1 ? "." : ""),
            start: originalPhrase.start + segmentDuration * index,
            end: originalPhrase.start + segmentDuration * (index + 1),
          }));

          return [
            ...prevPhrases.filter((p) => p.id !== id),
            ...newPhrases,
          ].sort((a, b) => a.start - b.start);
        });
      } else {
        setPhrases((prev) =>
          prev.map((phrase) =>
            phrase.id === id ? { ...phrase, text: newText.trim() } : phrase
          )
        );
      }
    } else {
      setPhrases((prev) =>
        prev.map((phrase) =>
          phrase.id === id ? { ...phrase, text: newText.trim() } : phrase
        )
      );
    }
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
    setPhrases((prev) => {
      const currentPhrase = prev.find((p) => p.id === id);
      if (!currentPhrase) return prev;

      const words = currentPhrase.text.split(" ");
      if (words.length < 2) return prev;

      const midPoint = Math.ceil(words.length / 2);
      const duration = currentPhrase.end - currentPhrase.start;
      const midTime = currentPhrase.start + duration / 2;

      const firstHalf = {
        ...currentPhrase,
        text: words.slice(0, midPoint).join(" "),
        end: midTime,
      };

      const secondHalf = {
        ...currentPhrase,
        id: `phrase-${Date.now()}`,
        text: words.slice(midPoint).join(" "),
        start: midTime,
        end: currentPhrase.end,
      };

      return [...prev.filter((p) => p.id !== id), firstHalf, secondHalf].sort(
        (a, b) => a.start - b.start
      );
    });
  };

  // Función para unir frases
  const handleMergePhrases = (id) => {
    setPhrases((prev) => {
      const currentIndex = prev.findIndex((p) => p.id === id);
      if (currentIndex === prev.length - 1) return prev;

      const currentPhrase = prev[currentIndex];
      const nextPhrase = prev[currentIndex + 1];

      const mergedPhrase = {
        ...currentPhrase,
        text: `${currentPhrase.text} ${nextPhrase.text}`,
        end: nextPhrase.end,
      };

      const newPhrases = [...prev];
      newPhrases.splice(currentIndex, 2, mergedPhrase);
      return newPhrases;
    });
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
      <EditorControls
        onAspectRatioChange={handleAspectRatioChange}
        onStyleChange={handleStyleChange} // Pasando el método para cambiar estilos
        initialAspectRatio={aspectRatio}
      />
      <div className="flex flex-col md:flex-row flex-1">
        {/* Editor de Subtítulos (sin cambios) */}
        <div className="flex-none md:w-1/3 bg-black border-t md:border-t-0 md:border-r border-gray-700 flex flex-col order-2 md:order-1">
          <div className="flex-none h-[40vh] md:h-[60vh] p-4 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-white">
              Editor de Subtítulos
            </h3>
            <div className="space-y-2">
              {phrases.map((phrase) => (
                <div
                  key={phrase.id}
                  className={`group relative flex items-start gap-4 p-2 rounded hover:bg-gray-700 ${
                    selectedPhraseIds.includes(phrase.id) ? "bg-gray-700" : ""
                  }`}
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

                  {/* Texto con edición en un clic */}
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPhraseId(phrase.id);
                    }}
                  >
                    {editingPhraseId === phrase.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="w-full bg-black text-white px-2 py-1 rounded"
                        defaultValue={phrase.text}
                        title={`Presiona ${
                          isMacOS() ? "⌘ Command" : "Alt"
                        } + Enter para dividir el texto en la posición del cursor`}
                        onBlur={(e) => {
                          if (editingPhraseId) {
                            handlePhraseEdit(phrase.id, e.target.value);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (e.altKey || e.metaKey) {
                              handlePhraseEdit(
                                phrase.id,
                                e.target.value,
                                e.target.selectionStart
                              );
                              e.preventDefault();
                            } else {
                              handlePhraseEdit(phrase.id, e.target.value);
                            }
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="group/text relative">
                        <p className="text-white text-sm md:text-base hover:text-pink-400 transition-colors">
                          {phrase.text}
                        </p>
                        <div className="invisible group-hover/text:visible absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-xs text-white px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                          {`Clic para editar (${
                            isMacOS() ? "⌘ + Enter" : "Alt + Enter"
                          } para dividir)`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acciones con tooltips */}
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPhraseId(phrase.id);
                      }}
                      className="p-1 hover:bg-gray-600 rounded text-pink-600 hover:text-white relative group/button"
                      title={`Editar texto (${
                        isMacOS() ? "⌘ + Enter" : "Alt + Enter"
                      } para dividir)`}
                    >
                      <Edit2 size={16} />
                      <div className="invisible group-hover/button:visible absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-xs text-white px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                        {`Editar texto (${
                          isMacOS() ? "⌘ + Enter" : "Alt + Enter"
                        } para dividir)`}
                      </div>
                    </button>
                    <button
                      onClick={() => handleSplitPhrase(phrase.id)}
                      className="p-1 hover:bg-gray-600 rounded text-pink-600 hover:text-white ml-1"
                      title="Dividir frase a la mitad"
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

        {/* Video Preview */}
        <div className="flex-none md:flex-1 flex flex-col order-1 md:order-2">
          <div className="h-68 md:h-auto p-2 md:p-4 bg-black">
            <div
              ref={videoContainerRef}
              className="relative mx-auto bg-gray-900 rounded-lg overflow-hidden min-h-[300px] max-h-[60vh]" // Agregado min-h-[300px]
              style={videoContainerStyle}
            >
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
                      const videoWidth = e.target.videoWidth;
                      const videoHeight = e.target.videoHeight;
                      const ratio = videoWidth / videoHeight;

                      let detectedRatio;
                      if (ratio >= 16 / 9) {
                        detectedRatio = "16:9";
                      } else if (ratio <= 9 / 16) {
                        detectedRatio = "9:16";
                      } else if (Math.abs(ratio - 1) < 0.1) {
                        detectedRatio = "1:1";
                      } else {
                        const ratios = [
                          { id: "16:9", value: 16 / 9 },
                          { id: "9:16", value: 9 / 16 },
                          { id: "1:1", value: 1 },
                        ];
                        detectedRatio = ratios.reduce((prev, curr) =>
                          Math.abs(curr.value - ratio) <
                          Math.abs(prev.value - ratio)
                            ? curr
                            : prev
                        ).id;
                      }

                      setAspectRatio(detectedRatio);
                      handleAspectRatioChange(detectedRatio);
                    }}
                    playsInline
                    webkit-playsinline="true"
                    x5-playsinline="true"
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                    preload="auto"
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
                      if (!videoElement) return null;

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
                          currentTime={currentTime * 1000}
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
              <LanguageSelectionModal
                isOpen={isLanguageModalOpen}
                onClose={() => setIsLanguageModalOpen(false)}
                onLanguageSelect={handleLanguageSelect}
              />
            </div>
          </div>
          {videoUrl && (
            <button
              onClick={() => {
                // Limpiar estado del video
                URL.revokeObjectURL(videoUrl);
                setVideoUrl("");
                setVideoFile(null);
                setPhrases([]);
                setCurrentTime(0);
                setDuration(0);
                setIsPlaying(false);
              }}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-black"
            >
              Eliminar Video
            </button>
          )}

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
      <div className="h-auto md:h-auto pb-5 bg-black border-t border-gray-800 flex flex-col">
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
        <div className="flex overflow-hidden">
          {/* Track labels */}
          <div className="w-24 md:w-48 py-5 flex-shrink-0 bg-black border-r border-gray-800">
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
          <div className="flex-1 py-5 overflow-x-scroll">
            <div
              ref={timelineRef}
              className={`h-full relative select-none ${
                isDragging ? "cursor-crosshair" : "cursor-default"
              }`}
              style={{
                width: `${Math.max(duration * 50 * zoom, 800)}px`,
              }}
              onMouseDown={handleTimelineMouseDown}
              onMouseMove={handleTimelineMouseMove}
              onMouseUp={handleTimelineMouseUp}
              onMouseLeave={handleTimelineMouseUp}
            >
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="h-16 border-b border-gray-800 relative"
                >
                  {track.type === "captions" &&
                    phrases.map((phrase) => (
                      <div
                        key={phrase.id}
                        className={`absolute h-full transition-colors duration-150
                        ${
                          selectedPhraseIds.includes(phrase.id)
                            ? "bg-blue-500 bg-opacity-40 border-blue-500"
                            : "bg-blue-500 bg-opacity-20 border-blue-500 hover:bg-opacity-30"
                        } border-l border-r cursor-pointer`}
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

              {/* Rectángulo de selección tipo marquee */}
              {isDragging && dragStart !== null && dragEnd !== null && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-10"
                  style={{
                    left: `${Math.min(dragStart, dragEnd) * 50 * zoom}px`,
                    width: `${Math.abs(dragEnd - dragStart) * 50 * zoom}px`,
                  }}
                >
                  {/* Fondo semi-transparente */}
                  <div className="absolute inset-0 bg-pink-500 bg-opacity-10" />

                  {/* Bordes animados */}
                  <div className="absolute inset-0 border border-pink-500 border-opacity-75">
                    {/* Esquinas animadas */}
                    <div className="absolute -left-0.5 -top-0.5 w-2 h-2 border-t-2 border-l-2 border-pink-500 animate-pulse" />
                    <div className="absolute -right-0.5 -top-0.5 w-2 h-2 border-t-2 border-r-2 border-pink-500 animate-pulse" />
                    <div className="absolute -left-0.5 -bottom-0.5 w-2 h-2 border-b-2 border-l-2 border-pink-500 animate-pulse" />
                    <div className="absolute -right-0.5 -bottom-0.5 w-2 h-2 border-b-2 border-r-2 border-pink-500 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-pink-500 z-20"
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
