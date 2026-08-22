import { ActionHandlerProps } from "./pluginTypes";

export function PluginDataViewer({ data }: { data: any }) {
  return (
    <pre className="text-xs bg-black/30 border border-gray-700 rounded-md p-2 overflow-x-auto">
      {JSON.stringify(data ?? {}, null, 2)}
    </pre>
  );
}

export function PluginDataEditorStub({
  data,
  onChange,
}: {
  data: any;
  onChange?: (next: any) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400">
        Editor не реализован в плагине (используется заглушка).
      </div>
      <PluginDataViewer data={data} />
    </div>
  );
}


export const PluginActionHandlerStub: React.FC<ActionHandlerProps> = ({ action, value }) => {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400">
        ActionHandler не реализован в плагине (используется заглушка).
      </div>
      <pre className="text-xs bg-black/30 border border-gray-700 rounded-md p-2 overflow-x-auto">
        {JSON.stringify({ action, value }, null, 2)}
      </pre>
    </div>
  );
};