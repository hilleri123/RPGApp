'use client';

import { DialogModeProvider } from '@/app/components/scenarios/dialogs/common/DialogModeContext';
import { EntityEditDialogShell } from '@/app/components/scenarios/dialogs/common/EntityEditDialogShell';
import { NoteMainTab } from '@/app/components/scenarios/dialogs/NoteEditDialog';
import { NoteShowTab } from './NoteShowTab';
import { Note } from '@/app/services/types2';

interface Props {
  open: boolean;
  onClose: () => void;
  note: Note | null;
  characters: { id: string; name: string }[];
  onShow: (noteId: string, characterIds: string[], includeMaster?: boolean) => Promise<void>;
  showMasterOption?: boolean;
  defaultIncludeMaster?: boolean;
}

export default function SessionNoteShowDialog({
  open, onClose, note, characters, onShow, showMasterOption = false, defaultIncludeMaster = true,
}: Props) {
  if (!note) return null;

  // dlg-заглушка для NoteMainTab (read-only, setForm не нужен)
  const dlg = {
    form: note,
    setForm: () => {},
    lookups: {},
    loading: false,
  };

  return (
    <DialogModeProvider readOnly={true}>
      <EntityEditDialogShell
        open={open}
        onClose={onClose}
        title={`Заметка: ${note.name}`}
        loading={false}
        readOnly={true}
        disableSave={true}
        onSave={() => {}}
        tabs={[
          {
            key: 'main',
            title: 'Текст',
            content: <NoteMainTab dlg={dlg} />,
          },
          {
            key: 'show',
            title: 'Показать',
            content: (
              <NoteShowTab
                note={note}
                characters={characters}
                showMasterOption={showMasterOption}
                defaultIncludeMaster={defaultIncludeMaster}
                onShow={(ids, includeMaster) => onShow(note.id, ids, includeMaster)}
              />
            ),
          },
        ]}
      />
    </DialogModeProvider>
  );
}
