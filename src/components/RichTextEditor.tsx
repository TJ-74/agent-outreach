"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";

/** Space after a link should not stay inside the link (default Link ties inclusive to autolink). */
const EmailLink = Link.extend({
  inclusive: () => false,
});
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Extension } from "@tiptap/core";
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

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

const LINE_HEIGHT_PRESETS = [
  { label: "Tight", value: "1.2" },
  { label: "Normal", value: "1.45" },
  { label: "Relaxed", value: "1.7" },
  { label: "Double", value: "2.0" },
] as const;

const LineHeightExtension = Extension.create<{ types: string[] }>({
  name: "lineHeight",
  addOptions() {
    return { types: ["paragraph", "heading"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (attrs: { lineHeight?: string }) =>
              attrs.lineHeight
                ? { style: `line-height: ${attrs.lineHeight}` }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }) => {
          return this.options.types.every((type) =>
            commands.updateAttributes(type, { lineHeight }),
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return this.options.types.every((type) =>
            commands.resetAttributes(type, "lineHeight"),
          );
        },
    };
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Smaller min-height for signatures and short fields */
  compact?: boolean;
}

function normalizeLinkHref(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(u)) return `mailto:${u}`;
  if (!/^https?:\/\//i.test(u)) return `https://${u}`;
  return u;
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

function LinkEditor({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(() => editor.getAttributes("link").href ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleApply = useCallback(() => {
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: normalizeLinkHref(url) })
        .run();
    }
    onClose();
  }, [editor, url, onClose]);

  const handleRemove = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  }, [editor, onClose]);

  return (
    <div className="flex flex-1 items-center gap-1.5 px-1">
      <input
        ref={inputRef}
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); handleApply(); }
          if (e.key === "Escape") onClose();
        }}
        placeholder="https://… or name@company.com"
        className="min-w-0 flex-1 rounded-[6px] border border-edge bg-cream/40 px-2.5 py-1 text-[12px] text-ink outline-none placeholder:text-ink-light focus:border-copper focus:ring-1 focus:ring-copper-light"
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
        title="Apply link (Enter)"
        className="cursor-pointer rounded-[5px] bg-copper p-1.5 text-white transition-colors hover:bg-copper-hover"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Cancel"
        className="cursor-pointer rounded-[5px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Toolbar({ editor, compact = false }: { editor: Editor; compact?: boolean }) {
  const [linkOpen, setLinkOpen] = useState(false);

  if (linkOpen) {
    return (
      <div
        className={`shrink-0 flex items-center gap-0.5 border-b border-edge px-3 ${compact ? "py-1.5" : "py-2"}`}
      >
        <ToolbarButton
          onClick={() => setLinkOpen(false)}
          active
          title="Insert link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarDivider />
        <LinkEditor editor={editor} onClose={() => setLinkOpen(false)} />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 flex flex-wrap items-center gap-0.5 border-b border-edge px-3 ${compact ? "py-1.5" : "py-2"}`}
    >
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
      <ToolbarButton
        onClick={() => setLinkOpen(true)}
        active={editor.isActive("link")}
        title="Insert link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

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

      {/* Line spacing — only shown in compact / signature editor */}
      {compact && (
        <>
          <ToolbarDivider />
          <div className="flex items-center gap-0.5">
            {LINE_HEIGHT_PRESETS.map((preset) => {
              const currentLh =
                editor.getAttributes("paragraph").lineHeight ?? "1.45";
              const isActive = currentLh === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  title={`Line spacing: ${preset.label}`}
                  onClick={() =>
                    editor.chain().focus().setLineHeight(preset.value).run()
                  }
                  className={`cursor-pointer rounded-[5px] px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                    isActive
                      ? "bg-copper-light text-copper"
                      : "text-ink-light hover:bg-cream hover:text-ink-mid"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Write your email…",
  className = "",
  compact = false,
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
      EmailLink.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          style: "color: #0563C1; text-decoration: underline;",
        },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      LineHeightExtension,
    ],
    content,
    editorProps: {
      attributes: {
        class: compact
          ? "prose prose-sm max-w-none px-4 py-3 min-h-[120px] text-[13px] leading-[1.45] text-ink-mid outline-none focus:outline-none [&_p]:leading-[1.45] [&_p]:my-0.5 [&_h1]:text-[16px] [&_h1]:font-bold [&_h1]:text-ink [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:leading-tight [&_h2]:text-[14px] [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-2 [&_h2]:mb-0.5 [&_h2]:leading-tight [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0 [&_li]:leading-[1.45] [&_a]:text-copper [&_a]:underline [&_hr]:my-2 [&_hr]:border-edge"
          : "prose prose-sm max-w-none px-5 py-4 min-h-[320px] text-[13px] leading-[1.7] text-ink-mid outline-none focus:outline-none [&_h1]:text-[18px] [&_h1]:font-bold [&_h1]:text-ink [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-3 [&_h2]:mb-1.5 [&_p]:my-1.5 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-copper [&_a]:underline [&_hr]:my-4 [&_hr]:border-edge",
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
    <div
      className={`flex min-h-0 flex-col rounded-b-[10px] ${className}`}
    >
      <Toolbar editor={editor} compact={compact} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
