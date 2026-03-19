"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useCallback, useState, useRef } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  RemoveFormatting,
  Minus,
  X,
  Check,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`cursor-pointer rounded-[5px] p-1.5 transition-colors disabled:opacity-30 ${
        active
          ? "bg-copper-light text-copper"
          : "text-ink-light hover:bg-cream hover:text-ink-mid"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px bg-edge" />;
}

function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = useCallback(() => {
    const existing = editor.getAttributes("link").href ?? "";
    setUrl(existing);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [editor]);

  const handleApply = useCallback(() => {
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = url.match(/^https?:\/\//) ? url : `https://${url}`;
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href })
        .run();
    }
    setOpen(false);
  }, [editor, url]);

  const handleRemove = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  }, [editor]);

  if (!open) {
    return (
      <ToolbarButton
        onClick={handleOpen}
        active={editor.isActive("link")}
        title="Insert link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
    );
  }

  return (
    <div className="relative">
      <ToolbarButton onClick={() => setOpen(false)} active title="Insert link">
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="absolute left-0 top-full z-20 mt-1.5 flex items-center gap-1.5 rounded-[10px] border border-edge bg-surface p-2 shadow-md">
        <input
          ref={inputRef}
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleApply();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="https://example.com"
          className="w-[220px] rounded-[6px] border border-edge bg-cream/40 px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-light focus:border-copper focus:ring-2 focus:ring-copper-light"
        />
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={handleRemove}
            title="Remove link"
            className="cursor-pointer rounded-[5px] p-1.5 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={handleApply}
          title="Apply link"
          className="cursor-pointer rounded-[5px] bg-copper p-1.5 text-white transition-colors hover:bg-copper-hover"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-edge px-3 py-2">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Align left"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Align center"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Align right"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Link */}
      <LinkPopover editor={editor} />

      {/* Horizontal rule */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear formatting"
      >
        <RemoveFormatting className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Write your email…",
  className = "",
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const skipSync = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-copper underline" },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none px-5 py-4 min-h-[320px] text-[13px] leading-[1.7] text-ink-mid outline-none focus:outline-none [&_h1]:text-[18px] [&_h1]:font-bold [&_h1]:text-ink [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-3 [&_h2]:mb-1.5 [&_p]:my-1.5 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-copper [&_a]:underline [&_hr]:my-4 [&_hr]:border-edge",
      },
    },
    onUpdate: ({ editor: e }) => {
      skipSync.current = true;
      onChangeRef.current(e.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    const currentHtml = editor.getHTML();
    if (content !== currentHtml) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className={`overflow-hidden ${className}`}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
