// scene.ts


export type SceneData = {
  character_id?: string | null;
  buff: number;
};

export type SceneConfig = {
  initialData: SceneData;

  constraints?: {
    buffMin?: number;
    buffMax?: number;
  };
};
