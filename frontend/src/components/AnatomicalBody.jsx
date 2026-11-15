import React from "react";

const ORGAN_GUIDE = {
  cardio: {
    titulo: "Sistema Cardiovascular",
    mide: "Pulso, presión arterial estimada y ritmo ECG (Astroskin).",
    accion: "Ante dolor en el pecho, sentar/recostar al tripulante, suspender esfuerzo y capturar ECG.",
    marte: "La microgravedad induce desacondicionamiento cardíaco y arritmias.",
  },
  resp: {
    titulo: "Respiratorio y Cabina",
    mide: "Oxigenación SpO₂, frecuencia respiratoria, P_I O₂ y ppCO₂.",
    accion: "Si SpO₂ < 94 % o sube CO₂, aplicar O₂ al 100 % y revisar depurador ECLSS.",
    marte: "En cabina cerrada, una fuga o fallo de filtrado genera hipoxia rápida.",
  },
  metab: {
    titulo: "Metabolismo y Glucemia",
    mide: "Glucosa en sangre (mg/dL) vía glucómetro o carga manual.",
    accion: "Si < 70 mg/dL y consciente, administrar 15–20 g de glucosa oral.",
    marte: "La desincronía circadiana y falta de sueño alteran la regulación glucémica.",
  },
  term: {
    titulo: "Termorregulación (Piel vs. Central)",
    mide: "Temperatura cutánea (Astroskin) y central estimada (normal ~37 °C).",
    accion: "Confirmar oral/central; abrigar si < 35 °C o activar enfriamiento LCVG si > 38 °C.",
    marte: "La piel cambia antes que el núcleo; diferenciar ambos evita subestimar hipotermia.",
  },
  neuro: {
    titulo: "Sueño, Ritmo Circadiano y Ánimo",
    mide: "Horas/eficiencia de sueño (Actiwatch, meta 8,5 h) y estado de ánimo.",
    accion: "Aplicar luz azul (≥ 250 lux) al despertar, oscuridad al dormir y evitar maniobras críticas.",
    marte: "El aislamiento prolongado y ciclo luz-oscuridad alterado afectan juicio e inmunidad.",
  },
};

export default function AnatomicalBody({ colors, selected, onSelect, lectura, tempCentral }) {
  const info = ORGAN_GUIDE[selected] || ORGAN_GUIDE.cardio;

  const isAlert = (c) => c === "#ef4444" || c === "#f59e0b" || c === "#06b6d4";
  const ring = (key) => (selected === key ? "#ffffff" : "rgba(255,255,255,0.2)");

  const liveMetrics = {
    cardio: `${lectura.frec_cardiaca} lpm · ${lectura.presion_sistolica} mmHg · ECG ${lectura.anomalia_ecg}`,
    resp: `SpO₂ ${lectura.spo2}% · ${lectura.frec_respiratoria} rpm`,
    metab: `Glucemia ${lectura.glucemia} mg/dL`,
    term: `Piel ${lectura.temp_corporal}°C · Central est. ${tempCentral}°C`,
    neuro: `Sueño ${lectura.horas_sueno}h (${lectura.eficiencia_sueno}%) · Ánimo ${lectura.estado_animo}/10`,
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Explorador Anatómico</span>
        <span style={{ color: "#60a5fa", fontSize: "0.72rem" }}>Clic en órgano</span>
      </div>

      <div className="body-svg-wrap">
        <svg viewBox="0 0 240 310" width="215" height="262" role="img" aria-label="Figura humana interactiva">
          {/* Rejilla sutil */}
          <defs>
            <pattern id="hudGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.6" opacity="0.5" />
            </pattern>
          </defs>
          <rect width="240" height="310" fill="url(#hudGrid)" rx="8" />

          {/* Silueta astronauta */}
          <circle cx="120" cy="42" r="24" fill="#172033" stroke="#475569" strokeWidth="2" />
          <path
            d="M80 76 C80 65, 160 65, 160 76 L176 164 L156 168 L150 106 L150 194 L158 296 L130 296 L123 206 L117 206 L110 296 L82 296 L90 194 L90 106 L84 168 L64 164 Z"
            fill="#172033"
            stroke="#475569"
            strokeWidth="2"
          />

          {/* 1. Neuro / Sueño y Ánimo */}
          <g className="organ-node" onClick={() => onSelect("neuro")}>
            {isAlert(colors.neuro) && (
              <circle cx="120" cy="40" r="19" fill="none" stroke={colors.neuro} strokeWidth="2" opacity="0.65">
                <animate attributeName="r" values="14;22;14" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx="120" cy="40" r="13" fill={colors.neuro} stroke={ring("neuro")} strokeWidth={selected === "neuro" ? 3 : 1.5} />
            <text x="120" y="43" textAnchor="middle" fill="#050811" fontSize="9" fontWeight="800">NEURO</text>
          </g>

          {/* 2. Pulmones / Respiratorio */}
          <g className="organ-node" onClick={() => onSelect("resp")}>
            <ellipse cx="101" cy="104" rx="12" ry="18" fill={colors.resp} stroke={ring("resp")} strokeWidth={selected === "resp" ? 3 : 1.5} opacity="0.86" />
            <ellipse cx="139" cy="104" rx="12" ry="18" fill={colors.resp} stroke={ring("resp")} strokeWidth={selected === "resp" ? 3 : 1.5} opacity="0.86" />
            <text x="101" y="107" textAnchor="middle" fill="#050811" fontSize="8" fontWeight="800">O₂</text>
            <text x="139" y="107" textAnchor="middle" fill="#050811" fontSize="8" fontWeight="800">O₂</text>
          </g>

          {/* 3. Corazón / Cardiovascular */}
          <g className="organ-node" onClick={() => onSelect("cardio")}>
            {isAlert(colors.cardio) && (
              <circle cx="122" cy="112" r="18" fill="none" stroke={colors.cardio} strokeWidth="2">
                <animate attributeName="r" values="12;22;12" dur="1.1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.1s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx="122" cy="112" r="12" fill={colors.cardio} stroke={ring("cardio")} strokeWidth={selected === "cardio" ? 3 : 1.5} />
            <text x="122" y="116" textAnchor="middle" fill="#050811" fontSize="12" fontWeight="900">♥</text>
          </g>

          {/* 4. Metabolismo / Glucosa */}
          <g className="organ-node" onClick={() => onSelect("metab")}>
            <rect x="99" y="140" width="42" height="22" rx="7" fill={colors.metab} stroke={ring("metab")} strokeWidth={selected === "metab" ? 3 : 1.5} />
            <text x="120" y="155" textAnchor="middle" fill="#050811" fontSize="9" fontWeight="800">GLU</text>
          </g>

          {/* 5. Piel / Termorregulación */}
          <g className="organ-node" onClick={() => onSelect("term")}>
            <line x1="154" y1="126" x2="173" y2="126" stroke={colors.term} strokeWidth="2.5" />
            <rect x="172" y="113" width="44" height="25" rx="6" fill={colors.term} stroke={ring("term")} strokeWidth={selected === "term" ? 3 : 1.5} />
            <text x="194" y="129" textAnchor="middle" fill="#050811" fontSize="10" fontWeight="800">T°C</text>
          </g>
        </svg>
      </div>

      <div className="system-pills">
        {[
          ["neuro", "🧠 Neuro"],
          ["cardio", "🫀 Cardio"],
          ["resp", "🫁 Pulmón"],
          ["metab", "🩸 Gluc."],
          ["term", "🌡️ Piel"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`sys-pill ${selected === key ? "active" : ""}`}
            onClick={() => onSelect(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="organ-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "#ffffff" }}>{info.titulo}</strong>
        </div>
        <div className="tabular" style={{ color: "#93c5fd", fontSize: "0.75rem", fontWeight: 700 }}>
          {liveMetrics[selected]}
        </div>
        <div className="organ-card-row"><b>Mide:</b> {info.mide}</div>
        <div className="organ-card-row"><b>Acción:</b> {info.accion}</div>
        <div className="organ-card-row"><b>Marte:</b> {info.marte}</div>
      </div>
    </div>
  );
}
