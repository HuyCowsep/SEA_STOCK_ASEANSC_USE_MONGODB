//src/modals/DisplaySettingsModal.tsx
import { useState } from "react";
import { Modal, Checkbox } from "antd";
import type { ColumnVisibility } from "../types/tableConfig";
import styles from "../scss/DisplaySettingsModal.module.scss";

interface DisplaySettingsModalProps {
  open: boolean;
  columnVisibility: ColumnVisibility;
  onOk: (settings: ColumnVisibility) => void;
  onCancel: () => void;
}

// Cấu trúc phân cấp cho modal
type SingleItem = { type: "single"; key: keyof ColumnVisibility; label: string };
type GroupItem = { type: "group"; label: string; children: { key: keyof ColumnVisibility; label: string }[] };
type ModalItem = SingleItem | GroupItem;

const MODAL_ITEMS: ModalItem[] = [
  { type: "single", key: "symbol", label: "Mã Chứng Khoán" },
  { type: "single", key: "exchange", label: "Sàn (tên sàn)" },
  { type: "single", key: "reference", label: "Tham chiếu" },
  { type: "single", key: "ceiling", label: "Trần" },
  { type: "single", key: "floor", label: "Sàn (giá sàn)" },
  { type: "single", key: "totalTrading", label: "Tổng KL" },
  { type: "single", key: "totalValue", label: "Tổng GT" },
  {
    type: "group",
    label: "Bên mua",
    children: [
      { key: "bidPrice1", label: "Giá 1" },
      { key: "bidPrice2", label: "Giá 2" },
      { key: "bidPrice3", label: "Giá 3" },
      { key: "bidVol1", label: "KL 1" },
      { key: "bidVol2", label: "KL 2" },
      { key: "bidVol3", label: "KL 3" },
    ],
  },
  {
    type: "group",
    label: "Bên bán",
    children: [
      { key: "offerPrice1", label: "Giá 1" },
      { key: "offerPrice2", label: "Giá 2" },
      { key: "offerPrice3", label: "Giá 3" },
      { key: "offerVol1", label: "KL 1" },
      { key: "offerVol2", label: "KL 2" },
      { key: "offerVol3", label: "KL 3" },
    ],
  },
  {
    type: "group",
    label: "Khớp lệnh",
    children: [
      { key: "matchPrice", label: "Giá" },
      { key: "matchVol", label: "KL" },
      { key: "matchChange", label: "+/-" },
      { key: "matchChangePercent", label: "%" },
    ],
  },
  {
    type: "group",
    label: "Giá",
    children: [
      { key: "priceHigh", label: "Cao" },
      { key: "priceAvg", label: "TB" },
      { key: "priceLow", label: "Thấp" },
    ],
  },
  {
    type: "group",
    label: "Dư",
    children: [
      { key: "surplusBid", label: "Mua" },
      { key: "surplusOffer", label: "Bán" },
    ],
  },
  {
    type: "group",
    label: "ĐTNN",
    children: [
      { key: "foreignBuy", label: "Mua" },
      { key: "foreignSell", label: "Bán" },
      { key: "foreignRemain", label: "NN Room" },
    ],
  },
];

const DisplaySettingsModal = ({ open, columnVisibility, onOk, onCancel }: DisplaySettingsModalProps) => {
  const [temp, setTemp] = useState<ColumnVisibility>(columnVisibility);

  const toggle = (key: keyof ColumnVisibility, checked: boolean) => {
    setTemp((prev) => ({ ...prev, [key]: checked }));
  };

  // Toggle tất cả children của 1 group
  const toggleGroup = (children: { key: keyof ColumnVisibility }[], checked: boolean) => {
    setTemp((prev) => {
      const next = { ...prev };
      for (const c of children) next[c.key] = checked;
      return next;
    });
  };

  return (
    <Modal
      title="Tuỳ chỉnh hiển thị"
      open={open}
      onOk={() => onOk(temp)}
      onCancel={onCancel}
      okText="Áp dụng"
      cancelText="Huỷ"
      wrapClassName={styles.unitModal}
      width={420}
      afterOpenChange={(visible) => {
        if (visible) setTemp(columnVisibility);
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
        {MODAL_ITEMS.map((item, idx) => {
          if (item.type === "single") {
            return (
              <Checkbox key={idx} checked={temp[item.key]} onChange={(e) => toggle(item.key, e.target.checked)}>
                {item.label}
              </Checkbox>
            );
          }

          // Group item — parent checkbox + indeterminate + children
          const allChecked = item.children.every((c) => temp[c.key]);
          const someChecked = item.children.some((c) => temp[c.key]);

          return (
            <div key={idx}>
              <Checkbox
                checked={allChecked}
                indeterminate={!allChecked && someChecked}
                onChange={(e) => toggleGroup(item.children, e.target.checked)}
                style={{ fontWeight: 600 }}
              >
                {item.label}
              </Checkbox>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", paddingLeft: 24, marginTop: 4 }}>
                {item.children.map((child) => (
                  <Checkbox key={child.key} checked={temp[child.key]} onChange={(e) => toggle(child.key, e.target.checked)}>
                    {child.label}
                  </Checkbox>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default DisplaySettingsModal;
