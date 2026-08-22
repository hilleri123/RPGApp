// location.ts
export type LocationData = {
  temperatureC?: number; // -100..200
  illumination?: number; // 0..100
};

export type LocationConfig = {
  constraints?: {
    temperatureMin?: number;
    temperatureMax?: number;
    illuminationMin?: number;
    illuminationMax?: number;
  };
  initialData: LocationData;
};
