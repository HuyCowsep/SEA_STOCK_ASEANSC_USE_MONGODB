import { useState } from "react";
import { Modal, Radio } from "antd";
import type { UnitSettings } from "../types/tableConfig";
import styles from "../scss/UnitSettingsModal.module.scss";

interface UnitSettingsModalProps {
  open: boolean;
  unitSettings: UnitSettings;
  onOk: (settings: UnitSettings) => void;
  onCancel: () => void;
}

const UnitSettingsModal = ({ open, unitSettings, onOk, onCancel }: UnitSettingsModalProps) => {
  const [tempUnit, setTempUnit] = useState<UnitSettings>(unitSettings);

  return (
    <Modal
      title="Cài đặt đơn vị"
      open={open}
      onOk={() => onOk(tempUnit)}
      onCancel={onCancel}
      okText="Áp dụng"
      cancelText="Huỷ"
      wrapClassName={styles.unitModal}
      width={420}
      afterOpenChange={(visible) => {
        if (visible) setTempUnit(unitSettings);
      }}
    >
      <div className={styles.unitGroup}>
        <label className={styles.unitLabel}>Đơn vị KL (Khối lượng)</label>
        <Radio.Group value={tempUnit.volume} onChange={(e) => setTempUnit({ ...tempUnit, volume: e.target.value })}>
          <Radio value={1}>1</Radio>
          <Radio value={10}>10</Radio>
          <Radio value={100}>100</Radio>
        </Radio.Group>
      </div>

      <div className={styles.unitGroup}>
        <label className={styles.unitLabel}>Đơn vị giá</label>
        <Radio.Group value={tempUnit.price} onChange={(e) => setTempUnit({ ...tempUnit, price: e.target.value })}>
          <Radio value={1}>1</Radio>
          <Radio value={1000}>1,000</Radio>
        </Radio.Group>
      </div>

      <div className={styles.unitGroup}>
        <label className={styles.unitLabel}>Đơn vị giá trị</label>
        <Radio.Group value={tempUnit.value} onChange={(e) => setTempUnit({ ...tempUnit, value: e.target.value })}>
          <Radio value={1000000}>1,000,000</Radio>
          <Radio value={1000000000}>1,000,000,000</Radio>
        </Radio.Group>
      </div>
    </Modal>
  );
};

export default UnitSettingsModal;
