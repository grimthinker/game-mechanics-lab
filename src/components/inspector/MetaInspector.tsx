import React from 'react';

export interface MetaInspectorProps {
  name: string;
  onChange: (name: string) => void;
  isReadOnly?: boolean;
}

export const MetaInspector: React.FC<MetaInspectorProps> = ({ name, onChange, isReadOnly }) => (
  <label>
    Имя / Название:
    <input
      disabled={isReadOnly}
      type="text"
      value={name}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);