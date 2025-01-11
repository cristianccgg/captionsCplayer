import React, { useState, useEffect } from "react";
import {
  LayoutGrid as AspectRatioIcon,
  Palette as PaletteIcon,
  Keyboard as KeyboardIcon,
} from "lucide-react";

const EditorControls = ({
  onAspectRatioChange,
  onStyleChange,
  initialAspectRatio = "16:9",
}) => {
  const [currentAspectRatio, setCurrentAspectRatio] =
    useState(initialAspectRatio);
  const [currentStyle, setCurrentStyle] = useState("modern");

  const stylePresets = {
    modern: {
      fontSize: 36,
      fontFamily: "'Inter', sans-serif",
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      position: "bottom",
      highlightColor: "#FFFFFF", // Sin highlight
    },
    highlight: {
      fontSize: 30,
      fontFamily: "'Bebas Neue', cursive",
      color: "#FFFFFF",
      backgroundColor: "transparent",
      textAlign: "center",
      position: "bottom",
      highlightColor: "#FBBF24", // Color de highlight
    },
    shorts: {
      fontSize: 42,
      fontFamily: "'Roboto', sans-serif",
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      position: "center",
      highlightColor: "#FFFFFF",
    },
    gaming: {
      fontSize: 38,
      fontFamily: "'Bebas Neue', cursive",
      color: "#00FF00",
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      position: "top",
      highlightColor: "#00FF00",
    },
  };
  useEffect(() => {
    setCurrentAspectRatio(initialAspectRatio);
  }, [initialAspectRatio]);

  return (
    <div className="flex flex-col md:flex-row items-start justify-between gap-4 p-4  rounded-lg">
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Presets de Estilo */}
        <div className="flex items-center gap-2">
          <h1 className="text-white">Caption Presets</h1>
          <PaletteIcon className="w-5 h-5 text-pink-500" />
          <select
            value={currentStyle}
            onChange={(e) => {
              const selectedStyle = e.target.value;
              setCurrentStyle(selectedStyle);

              // Usar onStyleChange pasado desde el padre
              onStyleChange(stylePresets[selectedStyle]);
            }}
            className="bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 min-w-[200px]"
          >
            <option value="modern">Modern YouTube</option>
            <option value="highlight">Con Highlight</option>
            <option value="shorts">Shorts Style</option>
            <option value="gaming">Gaming</option>
          </select>
        </div>
      </div>

      {/* Atajos de Teclado */}
      <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-md">
        <KeyboardIcon className="w-5 h-5 text-pink-500" />
        <div className="text-xs text-gray-300">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>Espacio</span>
            <span>Play/Pause</span>
            <span>{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + Z</span>
            <span>Deshacer</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorControls;
