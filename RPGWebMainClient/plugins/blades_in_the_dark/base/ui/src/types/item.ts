export type ItemData = {
  id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  quality?: number | null; // одна характеристика
};

export type ItemConfig = {
  tags?: string[];
  initialData: ItemData;
};
