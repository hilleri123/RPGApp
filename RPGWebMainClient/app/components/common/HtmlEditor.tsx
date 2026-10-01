'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { FontSize } from '@tiptap/extension-text-style/font-size'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Underline } from 'lucide-react'
import { makeTextPreview } from '@/lib/htmlPreview'

interface HtmlEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  readOnly?: boolean
  /** Макс длина превью в readOnly-режиме (по желанию) */
  previewMaxLen?: number
}

export default function HtmlEditor({
  value,
  onChange,
  placeholder = 'Введите текст…',
  readOnly = false,
  previewMaxLen = 0,
}: HtmlEditorProps) {
  // readOnly с ограничением длины: обычный текст без HTML — ничего не исполняется
  if (readOnly && previewMaxLen > 0) {
    const text = makeTextPreview(value, {
      treatAsHtml: true,
      maxLen: previewMaxLen,
      wordBoundary: true,
      ellipsis: '…',
    })

    return (
      <div className="border border-gray-600 rounded bg-gray-800 px-3 py-2 min-h-[40px] text-sm text-gray-100 whitespace-pre-wrap">
        {text}
      </div>
    )
  }

  // readOnly без ограничения: показываем форматирование, но через схему TipTap,
  // а не через dangerouslySetInnerHTML. Схема пропускает только известные теги
  // и атрибуты, поэтому <script>, onerror= и javascript:-ссылки отбрасываются.
  if (readOnly) {
    return <ReadOnlyHtml value={value} />
  }

  return <Editor value={value} onChange={onChange} placeholder={placeholder} />
}

function ReadOnlyHtml({ value }: { value: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bold: {}, italic: {} }),
      Color.configure({ types: ['textStyle'] }),
      TextStyle,
      FontSize,
    ],
    content: value || '',
    editable: false,
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  return (
    <div className="border border-gray-600 rounded bg-gray-800 px-3 py-2 min-h-[40px] text-sm text-gray-100 prose prose-sm prose-invert max-w-none">
      {editor ? <EditorContent editor={editor} /> : null}
    </div>
  )
}

// отдельный компонент, чтобы хуки не вызывались при readOnly
function Editor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (html: string) => void
  placeholder: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bold: {}, italic: {} }),
      Color.configure({ types: ['textStyle'] }),
      TextStyle,
      FontSize,
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: false,
        showOnlyCurrent: false,
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return <div className="min-h-[100px] bg-gray-800 rounded border border-gray-600" />

  return (
    <div className="border border-gray-600 rounded bg-gray-800">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-600 bg-gray-900 text-gray-200">
        <button
          type="button"
          className={`p-1.5 hover:bg-gray-700 rounded ${editor.isActive('bold') ? 'bg-gray-700' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Жирный"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className={`p-1.5 hover:bg-gray-700 rounded ${editor.isActive('italic') ? 'bg-gray-700' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Курсив"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className={`p-1.5 hover:bg-gray-700 rounded ${editor.isActive('underline') ? 'bg-gray-700' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline?.().run()}
          title="Подчеркнутый"
        >
          <Underline size={16} />
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        <select
          className="px-2 py-1 text-sm border border-gray-600 rounded bg-gray-800 text-gray-100 hover:bg-gray-700"
          onChange={(e) =>
            editor.chain().focus().setFontSize(e.target.value + 'px').run()
          }
          defaultValue="16"
        >
          {[10, 12, 14, 16, 18, 24, 32].map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>

        <input
          type="color"
          className="w-8 h-8 border rounded cursor-pointer"
          onChange={(e) =>
            editor.chain().focus().setColor(e.target.value).run()
          }
          title="Цвет текста"
        />
      </div>

      <EditorContent
        editor={editor}
        className="min-h-[120px] p-3 text-gray-100 focus:outline-none prose prose-sm prose-invert max-w-none"
      />
    </div>
  )
}
