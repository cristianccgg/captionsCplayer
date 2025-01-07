import React from "react";
import {
  Bold,
  Italic,
  Type,
  PaintBucket,
  Droplets,
  Square,
  ChevronUp,
  ChevronDown,
  MoveVertical,
} from "lucide-react";

// Estilos por defecto sin Tailwind
const defaultStyles = {
  fontSize: 16,
  fontWeight: 400,
  fontStyle: "normal",
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: "#FFFFFF",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  textAlign: "center",
  position: "bottom",
  textStroke: false,
  highlightColor: "#FBBF24",
  customPosition: null,
};

// Opciones de fuentes con ejemplos de familias web seguras y Google Fonts populares
const fontOptions = [
  {
    name: "Sistema",
    value: "system-ui, -apple-system, sans-serif",
    fallback: "Arial, Helvetica, sans-serif",
  },
  {
    name: "Arial",
    value: "Arial, Helvetica, sans-serif",
    fallback: "sans-serif",
  },
  {
    name: "Verdana",
    value: "Verdana, Geneva, sans-serif",
    fallback: "sans-serif",
  },
  {
    name: "Roboto",
    value: "'Roboto', sans-serif",
    fallback: "Arial, Helvetica, sans-serif",
    link: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap",
  },
  {
    name: "Open Sans",
    value: "'Open Sans', sans-serif",
    fallback: "Arial, Helvetica, sans-serif",
    link: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap",
  },
  {
    name: "Montserrat",
    value: "'Montserrat', sans-serif",
    fallback: "Arial, Helvetica, sans-serif",
    link: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap",
  },
  {
    name: "Lato",
    value: "'Lato', sans-serif",
    fallback: "Arial, Helvetica, sans-serif",
    link: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
  },
  {
    name: "Source Sans Pro",
    value: "'Source Sans Pro', sans-serif",
    fallback: "Arial, Helvetica, sans-serif",
    link: "https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;700&display=swap",
  },
];

// Colores disponibles
const colorOptions = [
  { label: "Blanco", value: "#FFFFFF" },
  { label: "Amarillo", value: "#FBBF24" },
  { label: "Verde", value: "#34D399" },
  { label: "Azul", value: "#60A5FA" },
  { label: "Rojo", value: "#F87171" },
];

// Colores de fondo
const backgroundOptions = [
  { label: "Negro", value: "rgba(0, 0, 0, 1)" },
  { label: "Gris Oscuro", value: "rgba(31, 41, 55, 1)" },
  { label: "Azul Oscuro", value: "rgba(30, 58, 138, 1)" },
  { label: "Transparente", value: "transparent" },
];

export const SubtitleStyleControls = ({
  styles = defaultStyles,
  onStyleChange,
  selectedPhraseIds = [],
}) => {
  // Función para cargar fuentes externas
  const loadGoogleFont = (fontOption) => {
    if (
      fontOption.link &&
      !document.querySelector(`link[href="${fontOption.link}"]`)
    ) {
      const link = document.createElement("link");
      link.href = fontOption.link;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  };

  const handleFontChange = (fontFamily) => {
    const selectedFont = fontOptions.find((f) => f.value === fontFamily);
    if (selectedFont) {
      loadGoogleFont(selectedFont);
      onStyleChange("fontFamily", fontFamily);
    }
  };

  // Manejar cambio de posición personalizada
  const handleCustomPositionChange = (axis, value) => {
    const currentCustomPosition = styles.customPosition || {};
    const newCustomPosition = {
      ...currentCustomPosition,
      [axis]: value,
    };
    onStyleChange("customPosition", newCustomPosition);
  };

  // Resetear posición personalizada
  const resetCustomPosition = () => {
    onStyleChange("customPosition", null);
  };

  return (
    <div style={{ padding: "1rem", backgroundColor: "#1F2937" }}>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {/* Control de movimiento de subtítulos */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <MoveVertical size={16} color="#9CA3AF" />
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
          >
            <span style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>Y:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={
                styles.customPosition?.y ??
                (styles.position === "top"
                  ? 0.1
                  : styles.position === "middle"
                  ? 0.5
                  : 0.9)
              }
              onChange={(e) =>
                handleCustomPositionChange("y", parseFloat(e.target.value))
              }
              style={{ width: "6rem" }}
            />
          </div>
          <button
            onClick={resetCustomPosition}
            style={{
              padding: "0.25rem 0.5rem",
              backgroundColor: "transparent",
              border: "1px solid #374151",
              borderRadius: "0.25rem",
              color: "white",
              cursor: "pointer",
            }}
          >
            Resetear
          </button>
        </div>

        {/* Selector de fuente */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          }}
        >
          <Type size={16} color="#9CA3AF" />
          <select
            value={styles.fontFamily}
            onChange={(e) => handleFontChange(e.target.value)}
            style={{
              backgroundColor: "#374151",
              color: "white",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              border: "none",
              width: "200px",
            }}
          >
            {fontOptions.map((font) => (
              <option key={font.value} value={font.value}>
                {font.name}
              </option>
            ))}
          </select>
        </div>

        {/* Control de tamaño de fuente */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Type size={16} color="#9CA3AF" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              minWidth: "200px",
            }}
          >
            <input
              type="range"
              min="8"
              max="72"
              value={styles.fontSize}
              onChange={(e) =>
                onStyleChange("fontSize", parseInt(e.target.value))
              }
              style={{ flex: 1 }}
            />
            <span
              style={{
                padding: "0 0.5rem",
                color: "white",
                minWidth: "3rem",
                textAlign: "center",
                backgroundColor: "#374151",
                borderRadius: "0.25rem",
                fontSize: "0.875rem",
              }}
            >
              {styles.fontSize}px
            </span>
          </div>
        </div>

        {/* Controles de estilo de texto */}
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            onClick={() =>
              onStyleChange("fontWeight", styles.fontWeight === 700 ? 400 : 700)
            }
            style={{
              padding: "0.5rem",
              backgroundColor:
                styles.fontWeight === 700 ? "#374151" : "transparent",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}
          >
            <Bold size={16} color="#9CA3AF" />
          </button>
          <button
            onClick={() =>
              onStyleChange(
                "fontStyle",
                styles.fontStyle === "italic" ? "normal" : "italic"
              )
            }
            style={{
              padding: "0.5rem",
              backgroundColor:
                styles.fontStyle === "italic" ? "#374151" : "transparent",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}
          >
            <Italic size={16} color="#9CA3AF" />
          </button>
        </div>

        {/* Selector de color */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <PaintBucket size={16} color="#9CA3AF" />
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {colorOptions.map((color) => (
              <button
                key={color.value}
                onClick={() => onStyleChange("color", color.value)}
                style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  backgroundColor: color.value,
                  border:
                    styles.color === color.value
                      ? "2px solid white"
                      : "2px solid transparent",
                  borderRadius: "9999px",
                  cursor: "pointer",
                }}
                title={color.label}
              />
            ))}
          </div>
        </div>

        {/* Selector de color de resaltado */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>
            Resaltado
          </span>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {colorOptions.map((color) => (
              <button
                key={color.value}
                onClick={() => onStyleChange("highlightColor", color.value)}
                style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  backgroundColor: color.value,
                  border:
                    styles.highlightColor === color.value
                      ? "2px solid white"
                      : "2px solid transparent",
                  borderRadius: "9999px",
                  cursor: "pointer",
                }}
                title={color.label}
              />
            ))}
          </div>
        </div>

        {/* Selector de fondo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>Fondo</span>
          <select
            value={styles.backgroundColor}
            onChange={(e) => onStyleChange("backgroundColor", e.target.value)}
            style={{
              backgroundColor: "#374151",
              color: "white",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              border: "none",
            }}
          >
            {backgroundOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Control de opacidad */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Droplets size={16} color="#9CA3AF" />
          <input
            type="range"
            min="0"
            max="100"
            value={
              parseInt(styles.backgroundColor.split(",")[3] || "0.5") * 100
            }
            onChange={(e) => {
              const opacity = e.target.value / 100;
              const color = styles.backgroundColor
                .split(",")
                .slice(0, 3)
                .join(",");
              onStyleChange("backgroundColor", `${color}, ${opacity})`);
            }}
            style={{ width: "6rem" }}
          />
        </div>
      </div>
    </div>
  );
};

export default SubtitleStyleControls;
