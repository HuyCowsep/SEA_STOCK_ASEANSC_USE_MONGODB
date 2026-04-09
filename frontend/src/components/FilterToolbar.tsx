//src/components/FilterToolbar.tsx
import { memo, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Tooltip, Dropdown } from "antd";
import { SearchOutlined, PlayCircleOutlined, PauseCircleOutlined, SettingOutlined } from "@ant-design/icons";
import type { UnitSettings, ColumnVisibility } from "../types/tableConfig";
import UnitSettingsModal from "../modals/UnitSettingsModal";
import DisplaySettingsModal from "../modals/DisplaySettingsModal";
import styles from "../scss/FilterToolbar.module.scss";

// Dữ liệu cho search toàn bộ mã CK
interface SearchSymbolInfo {
  symbol: string;
  FullName?: string;
  exchange: "HOSE" | "HNX" | "UPCOM";
}

interface FilterToolbarProps {
  allSymbols: SearchSymbolInfo[]; // Toàn bộ mã CK từ 3 sàn — dùng cho search
  onSearchSelect: (symbol: string, exchange: "HOSE" | "HNX" | "UPCOM") => void; // Khi chọn mã từ dropdown search → chuyển sàn + bay đến
  selectedExchange: "HOSE" | "30" | "UPCOM" | "HNX" | "HNX30";
  onExchangeChange: (exchange: "HOSE" | "30" | "UPCOM" | "HNX" | "HNX30") => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  industryMap: Record<string, string[]>;
  presentationMode: boolean;
  onTogglePresentation: () => void;
  selectedBuyIn: string;
  onBuyInChange: (buyIn: string) => void;
  showWarrants: boolean;
  onWarrantsChange: (show: boolean) => void;
  showETF: boolean;
  onETFChange: (show: boolean) => void;
  unitSettings: UnitSettings;
  onUnitSettingsChange: (settings: UnitSettings) => void;
  columnVisibility: ColumnVisibility;
  onColumnVisibilityChange: (v: ColumnVisibility) => void;
}

interface FilterChild {
  value: string;
  label: string;
  disabled?: boolean;
}

interface FilterGroup {
  key: string;
  label: string;
  defaultValue?: string;
  children?: FilterChild[];
  isCategoryMenu?: boolean;
}

const FilterToolbar = ({
  allSymbols,
  onSearchSelect,
  selectedExchange,
  onExchangeChange,
  selectedCategory,
  onCategoryChange,
  industryMap,
  presentationMode,
  onTogglePresentation,
  // selectedBuyIn,
  onBuyInChange,
  onWarrantsChange,
  onETFChange,
  unitSettings,
  onUnitSettingsChange,
  columnVisibility,
  onColumnVisibilityChange,
}: FilterToolbarProps) => {
  // ====================== STATE ======================
  // activeGroup được tính từ selectedExchange/selectedCategory/... để luôn đồng bộ với trạng thái thực tế
  const [activeGroupOverride, setActiveGroupOverride] = useState<string | null>(null);
  const activeGroup = useMemo(() => {
    // Nếu có override (từ các filter không phải exchange như category, warrants, buyin...) thì dùng override
    if (activeGroupOverride) return activeGroupOverride;
    // Mặc định: tính từ selectedExchange
    if (selectedExchange === "HOSE" || selectedExchange === "30") return "hose";
    if (selectedExchange === "HNX" || selectedExchange === "HNX30") return "hnx";
    if (selectedExchange === "UPCOM") return "upcom";
    return "hose";
  }, [selectedExchange, activeGroupOverride]);

  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const hoverTimeoutRef = useRef<number | null>(null);

  // // Local sub-values cho filter chưa có logic Dashboard (oddlot, analysis)
  // const [localValues, setLocalValues] = useState<Record<string, string>>({
  //   oddlot: "HOSE",
  //   analysis: "increase",
  // });

  // Search state
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSymbolInfo[]>([]);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [displayModalOpen, setDisplayModalOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  // ====================== FILTER GROUPS CONFIG ======================
  const filterGroups: FilterGroup[] = [
    {
      key: "hose",
      label: activeGroup === "hose" && selectedExchange === "30" ? "VN30" : "HOSE",
      defaultValue: "HOSE",
      children: [
        { value: "HOSE", label: "HOSE" },
        { value: "30", label: "VN30" },
        { value: "_gdtt", label: "Giao dịch thoả thuận", disabled: true },
      ],
    },
    {
      key: "hnx",
      label: activeGroup === "hnx" && selectedExchange === "HNX30" ? "HNX30" : "HNX",
      defaultValue: "HNX",
      children: [
        { value: "HNX", label: "HNX" },
        { value: "HNX30", label: "HNX30" },
        { value: "_gdtt", label: "Giao dịch thoả thuận", disabled: true },
      ],
    },
    {
      key: "upcom",
      label: "UPCOM",
      defaultValue: "UPCOM",
      children: [
        { value: "UPCOM", label: "UPCOM" },
        { value: "_gdtt", label: "Giao dịch thoả thuận", disabled: true },
      ],
    },
    {
      key: "category",
      label: activeGroup === "category" && selectedCategory !== "all" ? `CP Ngành (${selectedCategory})` : "CP Ngành (Tất cả)",
      defaultValue: "all",
      isCategoryMenu: true,
      children: [{ value: "all", label: "Tất cả" }, ...Object.keys(industryMap).map((cat) => ({ value: cat, label: cat }))],
    },
    { key: "warrants", label: "Chứng quyền" },
    // { key: "bonds", label: "Trái phiếu" },
    { key: "etf", label: "ETF" },
    // { key: "tprl", label: "TPRL" },
    // {
    //   key: "oddlot",
    //   label: "Lô lẻ",
    //   defaultValue: "HOSE",
    //   children: [
    //     { value: "HOSE", label: "HOSE" },
    //     { value: "HNX", label: "HNX" },
    //     { value: "UPCOM", label: "UPCOM" },
    //   ],
    // },
    // {
    //   key: "analysis",
    //   label: "Công cụ phân tích",
    //   defaultValue: "increase",
    //   children: [
    //     { value: "increase", label: "Tăng nhiều nhất" },
    //     { value: "decrease", label: "Giảm nhiều nhất" },
    //     { value: "rights", label: "Sự kiện quyền" },
    //   ],
    // },
    // {
    //   key: "buyin",
    //   label: "Buy In",
    //   defaultValue: "HOSE",
    //   children: [
    //     { value: "HOSE", label: "HOSE" },
    //     { value: "HNX", label: "HNX" },
    //     { value: "UPCOM", label: "UPCOM" },
    //   ],
    // },
  ];

  // ====================== FILTER HANDLERS ======================

  // Main handler - mutual exclusion: chọn 1 cái = reset tất cả cái khác
  const handleFilterSelect = (groupKey: string, subValue?: string) => {
    // Reset tất cả Dashboard-level filters
    onWarrantsChange(false);
    onETFChange(false);
    onBuyInChange("");
    onCategoryChange("all");

    // Set active group (dùng override cho các filter không phải exchange thuần)
    // Với hose/hnx/upcom thì reset override → để useMemo tính từ selectedExchange
    const exchangeGroups = ["hose", "hnx", "upcom"];
    setActiveGroupOverride(exchangeGroups.includes(groupKey) ? null : groupKey);

    // Apply filter cụ thể
    switch (groupKey) {
      case "hose":
        onExchangeChange((subValue as "HOSE" | "30") || "HOSE");
        break;
      case "hnx":
        onExchangeChange((subValue as "HNX" | "HNX30") || "HNX");
        break;
      case "upcom":
        onExchangeChange("UPCOM");
        break;
      case "category":
        onCategoryChange(subValue || "all");
        break;
      case "warrants":
        onWarrantsChange(true);
        break;
      case "etf":
        onETFChange(true);
        break;
      // case "buyin":
      //   onBuyInChange(subValue || "HOSE");
      //   break;
      // case "oddlot":
      //   setLocalValues((prev) => ({ ...prev, oddlot: subValue || "HOSE" }));
      //   break;
      // case "analysis":
      //   setLocalValues((prev) => ({ ...prev, analysis: subValue || "increase" }));
        // break;
      // bonds, tprl: chưa có logic data, chỉ highlight
    }

    // Đóng dropdown
    setHoveredGroup(null);
  };

  // Lấy sub-value đang chọn để highlight trong dropdown
  const getSelectedChild = (groupKey: string): string | null => {
    switch (groupKey) {
      case "hose":
        return selectedExchange === "HOSE" || selectedExchange === "30" ? selectedExchange : null;
      case "hnx":
        return selectedExchange === "HNX" || selectedExchange === "HNX30" ? selectedExchange : null;
      case "upcom":
        return selectedExchange === "UPCOM" ? "UPCOM" : null;
      case "category":
        return selectedCategory;
      // case "oddlot":
      //   return localValues.oddlot || null;
      // case "analysis":
      //   return localValues.analysis || null;
      // case "buyin":
      //   return selectedBuyIn || null;
      default:
        return null;
    }
  };

  // ====================== HOVER HANDLERS ======================

  const handleGroupMouseEnter = (key: string, hasChildren: boolean, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (hasChildren) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 2, left: rect.left });
      setHoveredGroup(key);
    } else {
      setHoveredGroup(null);
    }
  };

  const handleGroupMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredGroup(null);
    }, 150);
  };

  // Khi hover vào dropdown, giữ nó mở bằng cách clear timeout ẩn
  const handleDropdownMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // Khi rời dropdown, bắt đầu timeout 1 giây để ẩn
  const handleDropdownMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredGroup(null);
    }, 100);
  };

  // Cleanup timeout khi component unmount để tránh lỗi setState trên component đã unmounted
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // ====================== SEARCH LOGIC ======================
  // Tìm kiếm từ toàn bộ mã CK (allSymbols) — không phụ thuộc filter đang chọn
  const updateSuggestions = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setSuggestions([]); //nếu search rỗng thì ko show dropdown
        return;
      }
      const searchLower = text.toLowerCase();

      // Tìm các mã bắt đầu bằng keyword → xếp A-Z
      const startsWithList = allSymbols
        .filter((item) => item.symbol.toLowerCase().startsWith(searchLower))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));

      // Tìm các mã chứa keyword (nhưng không bắt đầu bằng) → xếp theo vị trí keyword
      const includesList = allSymbols
        .filter((item) => {
          const symbol = item.symbol.toLowerCase();
          return !symbol.startsWith(searchLower) && symbol.includes(searchLower);
        })
        .sort((a, b) => {
          const aSymbol = a.symbol.toLowerCase();
          const bSymbol = b.symbol.toLowerCase();
          const indexA = aSymbol.indexOf(searchLower);
          const indexB = bSymbol.indexOf(searchLower);
          // Ưu tiên: keyword xuất hiện càng sớm → lên trên
          if (indexA !== indexB) return indexA - indexB;
          return aSymbol.localeCompare(bSymbol); // cùng vị trí thì xếp alphabet
        });

      setSuggestions([...startsWithList, ...includesList]);
      if (searchBoxRef.current) {
        const rect = searchBoxRef.current.getBoundingClientRect();
        setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    },
    [allSymbols],
  );

  //hàm thay đổi text search và cập nhật suggestions tương ứng
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    updateSuggestions(text);
  };

  // Đóng dropdown khi click ra ngoài hoặc cuộn trang
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    };

    const updatePosition = () => {
      if (suggestions.length > 0 && searchBoxRef.current) {
        const rect = searchBoxRef.current.getBoundingClientRect();
        setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [suggestions.length]);

  // Khi người dùng chọn 1 mã từ dropdown search → chuyển về sàn tương ứng và bay đến mã đó
  const handleSelectSymbol = (symbol: string, exchange: "HOSE" | "HNX" | "UPCOM") => {
    // Reset override để activeGroup tự tính từ selectedExchange (sàn mới)
    setActiveGroupOverride(null);
    onSearchSelect(symbol, exchange);
    setSearchText("");
    setSuggestions([]);
    const input = searchBoxRef.current?.querySelector("input");
    input?.focus(); // giữ focus sau khi chọn để tiện search tiếp
  };

  // ====================== SETTINGS MENU ======================
  const settingsMenu = {
    items: [
      { key: "display-settings", label: "Cài đặt đơn vị" },
      { key: "custom-display", label: "Tuỳ chỉnh hiển thị" },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "display-settings") setUnitModalOpen(true);
      if (key === "custom-display") setDisplayModalOpen(true);
    },
  };

  return (
    <div className={styles.filterToolbar}>
      <div className={styles.toolbarContainer}>
        {/* Tìm kiếm */}
        <div className={styles.filterItem} ref={searchBoxRef} style={{ position: "relative" }}>
          <div className={styles.searchBox}>
            <SearchOutlined className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Tìm mã chứng khoán"
              value={searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={styles.searchInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions.length > 0) {
                  //nhấn enter là nhảy luôn
                  const first = suggestions[0];
                  handleSelectSymbol(first.symbol, first.exchange);
                }
              }}
            />
          </div>
        </div>

        {/* Tất cả các filter */}
        {filterGroups.map((group) => (
          <div
            key={group.key}
            className={styles.customSelect}
            onMouseEnter={(e) => handleGroupMouseEnter(group.key, !!group.children, e)}
            onMouseLeave={handleGroupMouseLeave}
          >
            <div
              className={`${styles.customSelectTrigger} ${activeGroup === group.key ? styles.activeExchange : ""}`}
              onClick={() => handleFilterSelect(group.key, group.defaultValue)}
            >
              {group.label}
              {group.children && <span className={styles.arrow}>&#9662;</span>}
            </div>
          </div>
        ))}

        {/* Phần dropdown hiện ra của các filter */}
        {filterGroups.map(
          (group) =>
            group.children &&
            hoveredGroup === group.key &&
            createPortal(
              <div
                key={group.key}
                className={`${styles.customSelectMenuPortal} ${group.isCategoryMenu ? styles.categoryMenu : ""}`}
                style={{ top: menuPos.top, left: menuPos.left }}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
              >
                {group.children.map((child) => (
                  <div
                    key={child.value}
                    className={`${styles.customSelectOption} ${child.disabled ? styles.disabled : ""} ${
                      activeGroup === group.key && getSelectedChild(group.key) === child.value ? styles.selected : ""
                    }`}
                    onMouseDown={() => !child.disabled && handleFilterSelect(group.key, child.value)}
                  >
                    {child.label}
                  </div>
                ))}
              </div>,
              document.body,
            ),
        )}

        {/* Phần dropdown gợi ý khi tìm kiếm */}
        {suggestions.length > 0 &&
          createPortal(
            <div className={styles.searchDropdownPortal} style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}>
              {suggestions.map((stock) => (
                <div key={stock.symbol} className={styles.searchSuggestionItem} onMouseDown={() => handleSelectSymbol(stock.symbol, stock.exchange)}>
                  <span className={styles.suggestionSymbol}>{stock.symbol}</span>
                  <span className={styles.separator}> - </span>
                  <span className={styles.suggestionName}>{stock.FullName}</span>
                  <span className={styles.separator}> - </span>
                  <span className={styles.suggestionExchange}>{stock.exchange}</span>
                </div>
              ))}
            </div>,
            document.body,
          )}

        {/* Chế độ trình chiếu */}
        <div className={styles.filterItem}>
          <Tooltip title={presentationMode ? "Tắt chế độ trình chiếu" : "Bật chế độ trình chiếu"}>
            <button className={`${styles.filterButton} ${presentationMode ? styles.active : ""}`} onClick={onTogglePresentation}>
              {presentationMode ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            </button>
          </Tooltip>
        </div>

        {/* Cài đặt có 2 mục */}
        <div className={styles.filterItem}>
          <Dropdown menu={settingsMenu} trigger={["click"]} placement="bottomRight" overlayClassName={styles.settingsDropdown}>
            <Tooltip title="Cài đặt">
              <button className={styles.filterButton}>
                <SettingOutlined />
              </button>
            </Tooltip>
          </Dropdown>
        </div>
      </div>

      {/* Modal nút cài đặt 1 */}
      <UnitSettingsModal
        open={unitModalOpen}
        unitSettings={unitSettings}
        onOk={(settings) => {
          onUnitSettingsChange(settings);
          setUnitModalOpen(false);
        }}
        onCancel={() => setUnitModalOpen(false)}
      />
      {/* Modal nút cài đặt 2 */}
      <DisplaySettingsModal
        open={displayModalOpen}
        columnVisibility={columnVisibility}
        onOk={(settings) => {
          onColumnVisibilityChange(settings);
          setDisplayModalOpen(false);
        }}
        onCancel={() => setDisplayModalOpen(false)}
      />
    </div>
  );
};

export default memo(FilterToolbar);
