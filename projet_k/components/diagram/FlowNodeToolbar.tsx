import { useState } from "react";
import { ChevronDown, FolderPlus, Lock, Plus, Search, Trash2, Unlock } from "lucide-react";
import { Button } from "../ui/Button";

export type CreatableClockType =
  | "fixedSource"
  | "variableSource"
  | "discreteSource"
  | "editableValue"
  | "divider"
  | "multiplier"
  | "multiplexer"
  | "fractionalValue"
  | "distinctFrequencyOscillator"
  | "group";

export type MultiplexerProfile =
  | "lsco"
  | "rtc"
  | "system"
  | "psi"
  | "usbRng"
  | "cortex"
  | "usart"
  | "spi"
  | "i2c"
  | "mco1"
  | "mco2"
  | "adcDac"
  | "lptim1";

export type MuxProfileInput = {
  label: string;
  sourceType: string;
};

export type MuxProfile = {
  label: string;
  inputs: MuxProfileInput[];
};

export const MUX_PROFILES: Record<MultiplexerProfile, MuxProfile> = {
  lsco: { label: "LSCO Clock Mux", inputs: [{ label: "LSI", sourceType: "internal-source" }, { label: "LSE", sourceType: "external-source" }] },
  rtc: { label: "RTC Clock Mux", inputs: [{ label: "LSI", sourceType: "internal-source" }, { label: "LSE", sourceType: "external-source" }, { label: "HSE/128", sourceType: "divider-output" }] },
  system: { label: "System Clock Mux", inputs: [{ label: "HSI", sourceType: "internal-source" }, { label: "HSE", sourceType: "external-source" }, { label: "PLLCLK", sourceType: "pll-clock" }, { label: "MSI", sourceType: "internal-source" }] },
  psi: { label: "PSI Clock Mux", inputs: [{ label: "PSI", sourceType: "special-clock" }, { label: "PSI div", sourceType: "divider-output" }] },
  usbRng: { label: "USB RNG Clock Mux", inputs: [{ label: "HSI48", sourceType: "internal-source" }, { label: "PLLQ", sourceType: "pll-clock" }, { label: "Dedicated source", sourceType: "special-clock" }] },
  cortex: { label: "Cortex Clock Mux", inputs: [{ label: "SYSCLK", sourceType: "system-clock" }, { label: "HCLK", sourceType: "bus-clock" }, { label: "FCLK", sourceType: "system-clock" }, { label: "Cortex Div", sourceType: "divider-output" }] },
  usart: { label: "USARTx Clock Mux", inputs: [{ label: "PCLKx", sourceType: "bus-clock" }, { label: "SYSCLK", sourceType: "system-clock" }, { label: "HSI", sourceType: "internal-source" }, { label: "LSE", sourceType: "external-source" }] },
  spi: { label: "SPIx Clock Mux", inputs: [{ label: "PCLKx", sourceType: "bus-clock" }, { label: "SYSCLK", sourceType: "system-clock" }, { label: "PLL", sourceType: "pll-clock" }] },
  i2c: { label: "I2Cx Clock Mux", inputs: [{ label: "PCLKx", sourceType: "bus-clock" }, { label: "SYSCLK", sourceType: "system-clock" }, { label: "HSI", sourceType: "internal-source" }] },
  mco1: { label: "MCO1 Clock Mux", inputs: [{ label: "SYSCLK", sourceType: "system-clock" }, { label: "HSI", sourceType: "internal-source" }, { label: "LSE", sourceType: "external-source" }, { label: "HSE", sourceType: "external-source" }, { label: "PLLCLK", sourceType: "pll-clock" }] },
  mco2: { label: "MCO2 Clock Mux", inputs: [{ label: "SYSCLK", sourceType: "system-clock" }, { label: "PLLCLK", sourceType: "pll-clock" }, { label: "HSE", sourceType: "external-source" }, { label: "LSI", sourceType: "internal-source" }] },
  adcDac: { label: "ADC / DAC Clock Mux", inputs: [{ label: "PCLKx", sourceType: "bus-clock" }, { label: "SYSCLK", sourceType: "system-clock" }, { label: "PLL", sourceType: "pll-clock" }, { label: "HSI", sourceType: "internal-source" }] },
  lptim1: { label: "LPTIM1 Clock Mux", inputs: [{ label: "PCLKx", sourceType: "bus-clock" }, { label: "LSE", sourceType: "external-source" }, { label: "LSI", sourceType: "internal-source" }, { label: "HSI", sourceType: "internal-source" }] }
};

const CLOCK_TYPES: Array<{ value: CreatableClockType; label: string }> = [
  { value: "fixedSource", label: "Fixed source" },
  { value: "variableSource", label: "Variable source" },
  { value: "discreteSource", label: "Discrete source" },
  { value: "editableValue", label: "Editable value" },
  { value: "divider", label: "Divider" },
  { value: "multiplier", label: "Multiplier" },
  { value: "multiplexer", label: "Multiplexer" },
  { value: "fractionalValue", label: "Fractional value" },
  { value: "distinctFrequencyOscillator", label: "Distinct-frequency oscillator" },
  { value: "group", label: "Rectangle" }
];

type SearchResult = {
  id: string;
  label: string;
  detail: string;
  type: CreatableClockType;
  muxProfile?: MultiplexerProfile;
  keywords: string;
};

const MUX_PROFILE_ALIASES: Partial<Record<MultiplexerProfile, string>> = {
  usart: "uart serial",
  i2c: "iic",
  adcDac: "adc dac analog",
  usbRng: "usb rng random",
  cortex: "cpu core",
  lptim1: "timer low power"
};

const SEARCHABLE_COMPONENTS: SearchResult[] = [
  ...CLOCK_TYPES.map((type) => ({
    id: type.value,
    label: type.label,
    detail: "Composant",
    type: type.value,
    keywords: `${type.label} ${type.value}`.toLowerCase()
  })),
  ...Object.entries(MUX_PROFILES).map(([profile, definition]) => ({
    id: `mux-${profile}`,
    label: definition.label,
    detail: "Type de multiplexeur",
    type: "multiplexer" as const,
    muxProfile: profile as MultiplexerProfile,
    keywords: `${definition.label} ${profile} ${MUX_PROFILE_ALIASES[profile as MultiplexerProfile] ?? ""} ${definition.inputs.map((input) => `${input.label} ${input.sourceType}`).join(" ")}`.toLowerCase()
  }))
];

type FlowNodeToolbarProps = {
  onAddNode: (type: CreatableClockType, muxProfile?: MultiplexerProfile) => void;
  onDeleteNode: () => void;
  canDelete: boolean;
};

export function FlowNodeToolbar({
  onAddNode,
  onDeleteNode,
  canDelete
}: FlowNodeToolbarProps) {
  const [selectedType, setSelectedType] = useState<CreatableClockType>("editableValue");
  const [selectedMuxProfile, setSelectedMuxProfile] = useState<MultiplexerProfile>("lsco");
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [isMuxSubmenuOpen, setIsMuxSubmenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const selectedTypeLabel = CLOCK_TYPES.find((type) => type.value === selectedType)?.label ?? "Editable value";
  const searchResults = SEARCHABLE_COMPONENTS.filter((component) =>
    component.keywords.includes(searchQuery.trim().toLowerCase())
  );

  const addSearchResult = (result: SearchResult) => {
    if (isReadOnly) return;
    onAddNode(result.type, result.muxProfile);
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  return (
    <div className="mb-2 flex items-start gap-2">
        <div
          className="relative"
          onMouseLeave={() => {
            setIsTypeMenuOpen(false);
            setIsMuxSubmenuOpen(false);
          }}
        >
          <button
            type="button"
            className={`flex h-9 min-w-48 items-center justify-between gap-3 rounded-md border px-3 text-xs font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#17146E]/25 ${
              isTypeMenuOpen
                ? "border-[#17146E] bg-[#17146E]/5 text-[#17146E]"
                : "border-gray-300 bg-white text-gray-700 hover:border-[#17146E]/50 hover:bg-gray-50"
            }`}
            disabled={isReadOnly}
            aria-haspopup="menu"
            aria-expanded={isTypeMenuOpen}
            onClick={() => {
              setIsTypeMenuOpen((open) => !open);
              setIsMuxSubmenuOpen(selectedType === "multiplexer");
            }}
          >
            {selectedTypeLabel}
            <ChevronDown
              size={15}
              aria-hidden="true"
              className={`transition-transform ${isTypeMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isTypeMenuOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 text-xs shadow-lg" role="menu">
              {CLOCK_TYPES.map((type) => (
                <div
                  key={type.value}
                  className="relative"
                  onMouseEnter={() => {
                    if (type.value === "multiplexer") setIsMuxSubmenuOpen(true);
                    else setIsMuxSubmenuOpen(false);
                  }}
                >
                  <button
                    type="button"
                    disabled={isReadOnly}
                    className={`flex w-full items-center px-2 py-1.5 text-left hover:bg-gray-100 ${selectedType === type.value ? "bg-gray-100" : ""}`}
                    role="menuitem"
                    onClick={() => {
                      setSelectedType(type.value);
                      if (type.value === "multiplexer") {
                        setIsMuxSubmenuOpen(true);
                      } else {
                        setIsMuxSubmenuOpen(false);
                        setIsTypeMenuOpen(false);
                      }
                    }}
                  >
                    {type.label}
                  </button>

                  {type.value === "multiplexer" && isMuxSubmenuOpen && (
                    <div className="absolute left-full top-0 w-52 border border-gray-300 bg-white py-1 shadow-md" role="menu" aria-label="Multiplexer profiles">
                      {Object.entries(MUX_PROFILES).map(([profile, definition]) => (
                        <button
                          key={profile}
                          type="button"
                          disabled={isReadOnly}
                          className={`w-full px-2 py-1.5 text-left hover:bg-gray-100 ${selectedMuxProfile === profile ? "bg-gray-100" : ""}`}
                          role="menuitem"
                          onClick={() => {
                            setSelectedMuxProfile(profile as MultiplexerProfile);
                            setSelectedType("multiplexer");
                            setIsTypeMenuOpen(false);
                          }}
                        >
                          {definition.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      <Button variant="secondary" disabled={isReadOnly} onClick={() => onAddNode(selectedType, selectedMuxProfile)} className={isReadOnly ? "cursor-not-allowed opacity-50" : ""}>
        <Plus size={14} />
        Add Node
      </Button>

      <Button
        variant="secondary"
        disabled={isReadOnly}
        onClick={() => window.dispatchEvent(new CustomEvent("clock-group-request"))}
        title="Sélectionnez au moins deux composants avec Ctrl, puis créez le groupe"
        className={isReadOnly ? "cursor-not-allowed opacity-50" : ""}
      >
        <FolderPlus size={14} />
        Grouper sélection
      </Button>

      <div className="relative min-w-52">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          disabled={isReadOnly}
          value={searchQuery}
          placeholder="Rechercher un composant"
          aria-label="Rechercher un composant"
          onFocus={() => setIsSearchOpen(true)}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setIsSearchOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsSearchOpen(false);
            if (event.key === "Enter" && searchResults.length === 1) {
              addSearchResult(searchResults[0]);
            }
          }}
          className="h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 text-xs text-gray-700 outline-none transition focus:border-[#17146E] focus:ring-2 focus:ring-[#17146E]/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {isSearchOpen && searchQuery.trim() && (
          <div className="absolute left-0 top-full z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-xs shadow-lg" role="listbox" aria-label="Résultats de composants">
            {searchResults.length > 0 ? searchResults.map((component) => (
              <button
                key={component.id}
                type="button"
                role="option"
                className="flex w-full flex-col px-3 py-2 text-left text-gray-700 hover:bg-[#e8f4fb]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addSearchResult(component)}
              >
                <span>{component.label}</span>
                <span className="mt-0.5 text-[10px] text-gray-500">{component.detail}</span>
              </button>
            )) : (
              <div className="px-3 py-2 text-gray-500">Aucun composant</div>
            )}
          </div>
        )}
      </div>

      <Button
        variant="secondary"
        onClick={onDeleteNode}
        disabled={!canDelete || isReadOnly}
        className={!canDelete || isReadOnly ? "cursor-not-allowed opacity-50" : ""}
      >
        <Trash2 size={14} />
        Delete Node
      </Button>

      <Button
        variant="secondary"
        onClick={() => {
          const next = !isReadOnly;
          setIsReadOnly(next);
          setIsTypeMenuOpen(false);
          setIsMuxSubmenuOpen(false);
          setIsSearchOpen(false);
          window.dispatchEvent(new CustomEvent("clock-read-only-change", { detail: next }));
        }}
        title={isReadOnly ? "Quitter le mode lecture seule" : "Afficher le graphe en lecture seule"}
        className={`ml-auto ${isReadOnly ? "border-red-400 bg-red-50 text-red-700" : ""}`}
      >
        {isReadOnly ? <Lock size={14} /> : <Unlock size={14} />}
        {isReadOnly ? "Lecture seule" : "Modifier"}
      </Button>
    </div>
  );
}