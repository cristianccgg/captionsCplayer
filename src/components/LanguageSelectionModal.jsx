import React, { useState } from "react";

const LANGUAGE_CODES = {
  es: "Español",
  en: "Inglés",
  fr: "Francés",
  de: "Alemán",
  it: "Italiano",
  pt: "Portugués",
  auto: "Detección Automática",
};

export function LanguageSelectionModal({ isOpen, onClose, onLanguageSelect }) {
  const [selectedLanguage, setSelectedLanguage] = useState("auto");

  const handleConfirm = () => {
    onLanguageSelect(selectedLanguage);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-white">
          Selecciona el idioma de transcripción
        </h2>

        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="w-full bg-gray-700 text-white p-2 rounded mb-4"
        >
          {Object.entries(LANGUAGE_CODES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex justify-center space-x-2">
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-500"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
