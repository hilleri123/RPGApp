// character.ts


export type CharacterData = {
  profession: string;
};

// Если у тебя менеджер всё равно отдаёт config() с initialData + constraints — оставим.
export type CharacterConfig = {
  initialData: CharacterData;

  constraints?: {
    professionMinLen?: number;
    professionMaxLen?: number;
  };
};
