import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlayerCharacter } from '@/app/services/types2';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';
import { EntityEditDialogShell } from '../scenarios/dialogs/common/EntityEditDialogShell';
import { CharacterItemsTab, CharacterMainTab, CharacterRulesTab } from '../scenarios/dialogs/tabs/character';
import { findPlayerWithCharacter } from './lobbyCharacterOccupancy';


interface CharacterInfoDialogProps {
  open: boolean;
  onClose: () => void;
  lobbyId: string;
  character: PlayerCharacter & { application_id?: string | null };
}

export function CharacterInfoDialog({
  open,
  onClose,
  lobbyId,
  character,
}: CharacterInfoDialogProps) {
  const {
    lobby, isPlayer, selfPlayer, rulesLoading, configs, pluginUI, playerSelectCharacter, playerSelectApplicationCharacter
  } = useLobbyWebSocket(lobbyId);


  const selectedBy = findPlayerWithCharacter(lobby?.players, character);
  const isSelectedBySomeone = !!selectedBy;
  const isSelectedByMe = !!selectedBy && selectedBy.id === selfPlayer?.id;
  const disableSelect = isSelectedBySomeone && !isSelectedByMe;

  const importedIds = (((lobby as any)?.imported_characters || []) as any[]).map((ch) => String(ch.id));
  const isImported = importedIds.includes(String(character.id));
  const applicationId = character.application_id ? String(character.application_id) : null;
    

  if (!character) return null;

  const dlg = {
    form: character,
    data: character.data,
    "assets": null,
    "lookups": [],
    "config": configs["character"],
    "issues": [],
  }

  return (
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={isImported ? 'Персонаж из заявки' : 'Персонаж'}
      loading={rulesLoading}
      readOnly={true}
      tabs={[
        { key: 'main', title: 'Досье', content: <CharacterMainTab dlg={dlg} /> },
        {
          key: 'items',
          title: 'Предметы',
          content: <CharacterItemsTab dlg={dlg} />,
        },
      ]}
      rules={{
        content: <CharacterRulesTab dlg={dlg} pluginUI={pluginUI} rulesMode="view" />,
        onValidate: () => {},
        onForceSave: () => {},
        forceSaveDisabled: false,
        loading: false,
      }}
      footer={isPlayer ? {
        align: 'left',
        render: ({ loading, onClose }) => (
          <Button variant="secondary" disabled={disableSelect} onClick={() => {
            if (isImported && applicationId) {
              playerSelectApplicationCharacter(applicationId);
            } else {
              playerSelectCharacter(String(character.id));
            }
            onClose();
          }}>
            {disableSelect ? "Уже выбран другим игроком" : isSelectedByMe ? "Выбран мною" : "Выбрать"}
          </Button>
        ),
        showInReadOnly: true,
      } : undefined}
    />
  );
}
