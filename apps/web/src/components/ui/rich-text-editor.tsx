"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Heading1,
  Heading2,
  Quote,
  Undo,
  Redo,
  Code,
} from "lucide-react";

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeight?: string;
}

function MenuBar({ editor }: { editor: Editor | null }) {
  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-2 bg-muted/30">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={cn("h-8 w-8 p-0", editor.isActive("underline") && "bg-muted")}
        title="Underline"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={cn("h-8 w-8 p-0", editor.isActive("code") && "bg-muted")}
        title="Code"
      >
        <Code className="h-4 w-4" />
      </Button>

      <div className="h-6 w-px bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={cn("h-8 w-8 p-0", editor.isActive("heading", { level: 1 }) && "bg-muted")}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn("h-8 w-8 p-0", editor.isActive("heading", { level: 2 }) && "bg-muted")}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>

      <div className="h-6 w-px bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-muted")}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-muted")}
        title="Ordered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={cn("h-8 w-8 p-0", editor.isActive("blockquote") && "bg-muted")}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </Button>

      <div className="h-6 w-px bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={setLink}
        className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-muted")}
        title="Add Link"
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
      {editor.isActive("link") && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="h-8 w-8 p-0"
          title="Remove Link"
        >
          <Unlink className="h-4 w-4" />
        </Button>
      )}

      <div className="h-6 w-px bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="h-8 w-8 p-0"
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="h-8 w-8 p-0"
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Start writing...",
  className,
  disabled = false,
  minHeight = "200px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  return (
    <div
      className={cn(
        "rounded-md border bg-background overflow-hidden",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <MenuBar editor={editor} />
      <EditorContent
        editor={editor}
        className={cn(
          "prose prose-sm max-w-none dark:prose-invert p-4",
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror]:min-h-[var(--editor-min-height)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0"
        )}
        style={{ "--editor-min-height": minHeight } as React.CSSProperties}
      />
    </div>
  );
}

// Simple wrapper for form integration
interface RichTextFieldProps extends RichTextEditorProps {
  error?: string;
  label?: string;
  required?: boolean;
  charCount?: number;
  maxChars?: number;
}

export function RichTextField({
  error,
  label,
  required,
  charCount,
  maxChars,
  ...props
}: RichTextFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium leading-none">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <RichTextEditor {...props} />
      <div className="flex justify-between text-xs text-muted-foreground">
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <span />
        )}
        {maxChars && (
          <span className={charCount && charCount > maxChars ? "text-destructive" : ""}>
            {charCount || 0}/{maxChars} characters
          </span>
        )}
      </div>
    </div>
  );
}
