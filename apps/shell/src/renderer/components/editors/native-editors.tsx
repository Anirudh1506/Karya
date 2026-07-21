import {
  Archive,
  Bold,
  CheckSquare,
  Code,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  Pencil,
  Quote,
  RotateCcw,
  Strikethrough,
  Underline,
  X,
} from "lucide-react";
import { Badge, Button, Surface } from "@karya/ui";
import type { KernelSnapshot } from "@karya/core";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ResourceSnapshot, TaskPriority, TaskStatus } from "../../types";
import {
  countWords,
  displayWorkspaceName,
  formatTaskPriority,
  formatTaskStatus,
  readStringAttribute,
  readTaskPriority,
  readTaskStatus,
} from "../../resources/resource-utils";

export function NativeNoteEditor({
  note,
  onArchive,
  onClose,
  onRename,
  onUpdateContent,
  snapshot,
}: {
  note: ResourceSnapshot;
  onArchive(resourceId: string): void;
  onClose(): void;
  onRename(resource: ResourceSnapshot): void;
  onUpdateContent(resourceId: string, content: string): Promise<void>;
  snapshot?: KernelSnapshot;
}): ReactElement {
  const [content, setContent] = useState(noteContentToHtml(readStringAttribute(note, "noteContent") ?? ""));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [pendingClose, setPendingClose] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const persistedContent = noteContentToHtml(readStringAttribute(note, "noteContent") ?? "");
  const [lastSavedContent, setLastSavedContent] = useState(persistedContent);
  const workspaceId = note.primaryWorkspaceId ?? note.workspaceRefs[0];
  const workspace = snapshot?.workspaces.all.find((candidate) => candidate.id === workspaceId);
  const profile = snapshot?.profiles.all.find((candidate) => candidate.id === note.profileId);
  const plainText = htmlToPlainText(content);
  const wordCount = countWords(plainText);
  const readingTime = Math.max(1, Math.ceil(wordCount / 220));
  const isDirty = content !== lastSavedContent;

  useEffect(() => {
    const nextContent = noteContentToHtml(readStringAttribute(note, "noteContent") ?? "");
    setContent(nextContent);
    setLastSavedContent(nextContent);
    setSaveState("saved");
    selectionRef.current = null;
  }, [note.id]);

  useEffect(() => {
    if (persistedContent === lastSavedContent) return;
    setLastSavedContent(persistedContent);
    if (!isDirty && editorRef.current && editorRef.current.innerHTML !== persistedContent) {
      editorRef.current.innerHTML = persistedContent;
      setContent(persistedContent);
    }
  }, [isDirty, lastSavedContent, persistedContent]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      restoreEditorSelection(editorRef.current, selectionRef.current);
    });
  }, [note.id]);

  const captureSelection = () => {
    selectionRef.current = captureEditorSelection(editorRef.current);
  };

  const focusEditor = () => {
    window.requestAnimationFrame(() => {
      if (editorRef.current && editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
      editorRef.current?.focus();
      restoreEditorSelection(editorRef.current, selectionRef.current);
    });
  };

  const syncEditorContent = () => {
    captureSelection();
    setContent(sanitizeNoteHtml(editorRef.current?.innerHTML ?? ""));
  };

  const runEditorCommand = (command: string, value?: string) => {
    focusEditor();
    window.requestAnimationFrame(() => {
      restoreEditorSelection(editorRef.current, selectionRef.current);
      document.execCommand(command, false, value);
      syncEditorContent();
    });
  };

  const save = async () => {
    const nextContent = sanitizeNoteHtml(editorRef.current?.innerHTML ?? content);
    if (nextContent === lastSavedContent) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    await onUpdateContent(note.id, nextContent);
    setContent(nextContent);
    setLastSavedContent(nextContent);
    setSaveState("saved");
  };

  useEffect(() => {
    if (!isDirty) {
      setSaveState("saved");
      return;
    }
    setSaveState("dirty");
    const timeout = window.setTimeout(() => {
      void save();
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [content, isDirty]);

  const discard = () => {
    const nextContent = persistedContent;
    setContent(nextContent);
    setLastSavedContent(nextContent);
    if (editorRef.current) editorRef.current.innerHTML = nextContent;
    selectionRef.current = null;
    setSaveState("saved");
  };

  const requestClose = () => {
    if (isDirty) {
      setPendingClose(true);
      return;
    }
    onClose();
  };

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const modifier = event.metaKey || event.ctrlKey;
    const checklistItem = getCurrentChecklistItem(editorRef.current);
    if (modifier && event.key.toLocaleLowerCase() === "s") {
      event.preventDefault();
      void save();
      return;
    }
    if (modifier && event.key.toLocaleLowerCase() === "z") {
      return;
    }
    if (
      (modifier && event.key.toLocaleLowerCase() === "y") ||
      (modifier && event.shiftKey && event.key.toLocaleLowerCase() === "z")
    ) {
      return;
    }
    if (modifier && event.key.toLocaleLowerCase() === "b") {
      event.preventDefault();
      runEditorCommand("bold");
      return;
    }
    if (modifier && event.key.toLocaleLowerCase() === "i") {
      event.preventDefault();
      runEditorCommand("italic");
      return;
    }
    if (modifier && event.key.toLocaleLowerCase() === "u") {
      event.preventDefault();
      runEditorCommand("underline");
      return;
    }
    if (modifier && event.shiftKey && event.key === "7") {
      event.preventDefault();
      runEditorCommand("insertOrderedList");
      return;
    }
    if (modifier && event.shiftKey && event.key === "8") {
      event.preventDefault();
      runEditorCommand("insertUnorderedList");
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (checklistItem) {
        indentChecklistItem(checklistItem, event.shiftKey ? -1 : 1);
        syncEditorContent();
        return;
      }
      runEditorCommand(event.shiftKey ? "outdent" : "indent");
      return;
    }
    if (event.key === "Enter" && checklistItem) {
      event.preventDefault();
      if (event.shiftKey) {
        document.execCommand("insertHTML", false, "<br>");
        syncEditorContent();
        return;
      }
      if (isChecklistItemEmpty(checklistItem)) {
        exitChecklistItem(checklistItem);
      } else {
        insertChecklistItemAfter(checklistItem);
      }
      syncEditorContent();
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-hidden">
      <section className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-5 shadow-[var(--karya-shadow-card)]">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Native Note</Badge>
              <Badge>{readStringAttribute(note, "noteOrigin") ?? "native"}</Badge>
              <Badge>Editing</Badge>
              <Badge>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Unsaved"}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">{note.metadata.title}</h1>
            <p className="mt-2 text-sm text-[var(--karya-muted)]">
              {[profile?.name, workspace ? displayWorkspaceName(workspace) : undefined].filter(Boolean).join(" / ") ||
                "Karya Note"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => onRename(note)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onArchive(note.id)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button variant="ghost" size="sm" onClick={requestClose}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </section>

      <Surface className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--karya-border)] bg-[var(--karya-surface)] p-3">
          <EditorTool
            label="Heading"
            onClick={() => runEditorCommand("formatBlock", "h2")}
            icon={<Heading2 className="h-4 w-4" />}
          />
          <EditorTool label="Bold" onClick={() => runEditorCommand("bold")} icon={<Bold className="h-4 w-4" />} />
          <EditorTool label="Italic" onClick={() => runEditorCommand("italic")} icon={<Italic className="h-4 w-4" />} />
          <EditorTool
            label="Underline"
            onClick={() => runEditorCommand("underline")}
            icon={<Underline className="h-4 w-4" />}
          />
          <EditorTool
            label="Strikethrough"
            onClick={() => runEditorCommand("strikeThrough")}
            icon={<Strikethrough className="h-4 w-4" />}
          />
          <EditorTool
            label="Highlight"
            onClick={() => runEditorCommand("hiliteColor", "#fef08a")}
            icon={<Highlighter className="h-4 w-4" />}
          />
          <EditorTool
            label="Inline Code"
            onClick={() => runEditorCommand("formatBlock", "pre")}
            icon={<Code className="h-4 w-4" />}
          />
          <EditorTool
            label="Bullet List"
            onClick={() => runEditorCommand("insertUnorderedList")}
            icon={<List className="h-4 w-4" />}
          />
          <EditorTool
            label="Numbered List"
            onClick={() => runEditorCommand("insertOrderedList")}
            icon={<ListOrdered className="h-4 w-4" />}
          />
          <EditorTool
            label="Checklist"
            onClick={() => insertChecklistItem(editorRef.current, syncEditorContent)}
            icon={<CheckSquare className="h-4 w-4" />}
          />
          <EditorTool
            label="Quote"
            onClick={() => runEditorCommand("formatBlock", "blockquote")}
            icon={<Quote className="h-4 w-4" />}
          />
          <EditorTool
            label="Horizontal Rule"
            onClick={() => runEditorCommand("insertHorizontalRule")}
            icon={<Minus className="h-4 w-4" />}
          />
          <div className="ml-auto flex gap-2 text-xs text-[var(--karya-muted)]">
            <span>{wordCount} words</span>
            <span>{plainText.length} chars</span>
            <span>{readingTime} min read</span>
          </div>
        </div>
        <div
          ref={editorRef}
          className="note-editor min-h-0 flex-1 overflow-y-auto bg-[var(--karya-page)] p-8 text-base leading-8 text-[var(--karya-text)] outline-none"
          contentEditable
          suppressContentEditableWarning
          onBlur={captureSelection}
          onClick={(event) => handleEditorClick(event, syncEditorContent)}
          onInput={syncEditorContent}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={syncEditorContent}
          onMouseUp={captureSelection}
        />
      </Surface>
      {pendingClose ? (
        <UnsavedChangesDialog
          onCancel={() => setPendingClose(false)}
          onDiscard={() => {
            discard();
            setPendingClose(false);
            onClose();
          }}
          onSave={async () => {
            await save();
            setPendingClose(false);
            onClose();
          }}
        />
      ) : null}
    </div>
  );
}

export function NativeTaskEditor({
  task,
  onArchive,
  onClose,
  onComplete,
  onRename,
  onReopen,
  onUpdateTask,
  snapshot,
}: {
  task: ResourceSnapshot;
  onArchive(resourceId: string): void;
  onClose(): void;
  onComplete(resourceId: string): void;
  onRename(resource: ResourceSnapshot): void;
  onReopen(resourceId: string): void;
  onUpdateTask(
    resourceId: string,
    patch: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string;
      reminderAt?: string;
      parentTaskId?: string;
    },
  ): Promise<void>;
  snapshot?: KernelSnapshot;
}): ReactElement {
  const [description, setDescription] = useState(noteContentToHtml(readStringAttribute(task, "taskDescription") ?? ""));
  const [status, setStatus] = useState<TaskStatus>(readTaskStatus(task));
  const [priority, setPriority] = useState<TaskPriority>(readTaskPriority(task));
  const [dueDate, setDueDate] = useState(readStringAttribute(task, "taskDueDate") ?? "");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const persistedDescription = noteContentToHtml(readStringAttribute(task, "taskDescription") ?? "");
  const workspaceId = task.primaryWorkspaceId ?? task.workspaceRefs[0];
  const workspace = snapshot?.workspaces.all.find((candidate) => candidate.id === workspaceId);
  const profile = snapshot?.profiles.all.find((candidate) => candidate.id === task.profileId);
  const plainText = htmlToPlainText(description);
  const snapshotStatus = readTaskStatus(task);

  useEffect(() => {
    const nextDescription = noteContentToHtml(readStringAttribute(task, "taskDescription") ?? "");
    setDescription(nextDescription);
    setStatus(readTaskStatus(task));
    setPriority(readTaskPriority(task));
    setDueDate(readStringAttribute(task, "taskDueDate") ?? "");
    setSaveState("saved");
    selectionRef.current = null;
  }, [task.id]);

  useEffect(() => {
    setStatus(snapshotStatus);
  }, [snapshotStatus, task.id]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== description) {
      editorRef.current.innerHTML = description;
    }
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      restoreEditorSelection(editorRef.current, selectionRef.current);
    });
  }, [task.id]);

  const captureSelection = () => {
    selectionRef.current = captureEditorSelection(editorRef.current);
  };

  const syncEditorContent = () => {
    captureSelection();
    setDescription(sanitizeNoteHtml(editorRef.current?.innerHTML ?? ""));
  };

  const save = async (patch: Parameters<typeof onUpdateTask>[1] = {}) => {
    const nextDescription = sanitizeNoteHtml(editorRef.current?.innerHTML ?? description);
    const nextPatch = {
      description: nextDescription,
      status,
      priority,
      dueDate,
      ...patch,
    };
    setSaveState("saving");
    await onUpdateTask(task.id, nextPatch);
    setDescription(nextDescription);
    setSaveState("saved");
  };

  useEffect(() => {
    const dirty =
      description !== persistedDescription ||
      status !== readTaskStatus(task) ||
      priority !== readTaskPriority(task) ||
      dueDate !== (readStringAttribute(task, "taskDueDate") ?? "");
    if (!dirty) {
      setSaveState("saved");
      return;
    }
    setSaveState("dirty");
    const timeout = window.setTimeout(() => {
      void save();
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [description, dueDate, priority, status, task.id]);

  const runEditorCommand = (command: string, value?: string) => {
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      restoreEditorSelection(editorRef.current, selectionRef.current);
      document.execCommand(command, false, value);
      syncEditorContent();
    });
  };

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-hidden">
      <section className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-5 shadow-[var(--karya-shadow-card)]">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Native Task</Badge>
              <Badge>{formatTaskStatus(status)}</Badge>
              <Badge>{formatTaskPriority(priority)}</Badge>
              <Badge>{saveState === "saved" ? "Autosaved" : saveState === "saving" ? "Saving" : "Unsaved"}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">{task.metadata.title}</h1>
            <p className="mt-2 text-sm text-[var(--karya-muted)]">
              {[profile?.name, workspace ? displayWorkspaceName(workspace) : undefined].filter(Boolean).join(" / ") ||
                "Karya Task"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "completed" ? (
              <Button variant="secondary" size="sm" onClick={() => onReopen(task.id)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reopen
              </Button>
            ) : (
              <Button size="sm" onClick={() => onComplete(task.id)}>
                <CheckSquare className="mr-2 h-4 w-4" />
                Complete
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onRename(task)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onArchive(task.id)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </section>

      <Surface className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="grid gap-3 border-b border-[var(--karya-border)] bg-[var(--karya-surface)] p-4 lg:grid-cols-3">
          <label className="text-xs font-medium uppercase text-[var(--karya-subtle)]">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm normal-case text-[var(--karya-text)]"
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
            >
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="text-xs font-medium uppercase text-[var(--karya-subtle)]">
            Priority
            <select
              className="mt-1 w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm normal-case text-[var(--karya-text)]"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="text-xs font-medium uppercase text-[var(--karya-subtle)]">
            Due Date
            <input
              className="mt-1 w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm normal-case text-[var(--karya-text)]"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--karya-border)] bg-[var(--karya-surface)] p-3">
          <EditorTool label="Bold" onClick={() => runEditorCommand("bold")} icon={<Bold className="h-4 w-4" />} />
          <EditorTool label="Italic" onClick={() => runEditorCommand("italic")} icon={<Italic className="h-4 w-4" />} />
          <EditorTool
            label="Bullet List"
            onClick={() => runEditorCommand("insertUnorderedList")}
            icon={<List className="h-4 w-4" />}
          />
          <EditorTool
            label="Numbered List"
            onClick={() => runEditorCommand("insertOrderedList")}
            icon={<ListOrdered className="h-4 w-4" />}
          />
          <EditorTool
            label="Checklist"
            onClick={() => insertChecklistItem(editorRef.current, syncEditorContent)}
            icon={<CheckSquare className="h-4 w-4" />}
          />
          <div className="ml-auto text-xs text-[var(--karya-muted)]">{countWords(plainText)} words</div>
        </div>
        <div
          ref={editorRef}
          className="note-editor min-h-0 flex-1 overflow-y-auto bg-[var(--karya-page)] p-8 text-base leading-8 text-[var(--karya-text)] outline-none"
          contentEditable
          suppressContentEditableWarning
          onBlur={captureSelection}
          onClick={(event) => handleEditorClick(event, syncEditorContent)}
          onInput={syncEditorContent}
          onKeyUp={syncEditorContent}
          onMouseUp={captureSelection}
        />
      </Surface>
    </div>
  );
}

function EditorTool({ icon, label, onClick }: { icon: ReactNode; label: string; onClick(): void }): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {icon}
    </Button>
  );
}

function UnsavedChangesDialog({
  onCancel,
  onDiscard,
  onSave,
}: {
  onCancel(): void;
  onDiscard(): void;
  onSave(): Promise<void>;
}): ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">Unsaved Changes</p>
        <h2 className="mt-2 text-xl font-semibold">Save changes before leaving?</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          This note has local edits that have not been persisted through Karya Core yet.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
          <Button onClick={() => void onSave()}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function insertChecklistItem(editor: HTMLDivElement | null, onChange: () => void): void {
  if (!editor) return;
  editor.focus();
  document.execCommand("insertHTML", false, createChecklistItemHtml());
  onChange();
}

function createChecklistItemHtml(): string {
  return `<div class="note-checklist-item" data-indent="0"><input type="checkbox" /><span data-checklist-text="true">\u200b</span></div>`;
}

function getCurrentChecklistItem(editor: HTMLDivElement | null): HTMLElement | undefined {
  if (!editor) return undefined;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return undefined;
  const node = selection.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
  const checklistItem = element?.closest(".note-checklist-item");
  return checklistItem instanceof HTMLElement && editor.contains(checklistItem) ? checklistItem : undefined;
}

function isChecklistItemEmpty(item: HTMLElement): boolean {
  return (item.textContent ?? "").replace(/\u200b/g, "").trim().length === 0;
}

function insertChecklistItemAfter(item: HTMLElement): void {
  const next = document.createElement("div");
  next.className = "note-checklist-item";
  next.dataset.indent = item.dataset.indent ?? "0";
  next.style.marginLeft = item.style.marginLeft;
  next.innerHTML = `<input type="checkbox" /><span data-checklist-text="true">\u200b</span>`;
  item.after(next);
  focusChecklistText(next);
}

function exitChecklistItem(item: HTMLElement): void {
  const paragraph = document.createElement("p");
  paragraph.innerHTML = "<br>";
  item.replaceWith(paragraph);
  placeCaretInside(paragraph);
}

function indentChecklistItem(item: HTMLElement, delta: number): void {
  const current = Number(item.dataset.indent ?? "0");
  const next = Math.max(0, Math.min(6, current + delta));
  item.dataset.indent = String(next);
  item.style.marginLeft = `${next * 1.5}rem`;
}

function focusChecklistText(item: HTMLElement): void {
  const textNode = item.querySelector("[data-checklist-text='true']") ?? item;
  placeCaretInside(textNode);
}

function placeCaretInside(element: Element): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function handleEditorClick(event: MouseEvent<HTMLDivElement>, onSelectionChange: () => void): void {
  const checkbox = (event.target as HTMLElement | null)?.closest("input[type='checkbox']");
  if (checkbox instanceof HTMLInputElement) {
    window.requestAnimationFrame(() => {
      if (checkbox.checked) {
        checkbox.setAttribute("checked", "checked");
      } else {
        checkbox.removeAttribute("checked");
      }
      onSelectionChange();
    });
    return;
  }
  const anchor = (event.target as HTMLElement | null)?.closest("a");
  if (anchor instanceof HTMLAnchorElement) {
    if (event.metaKey || event.ctrlKey) {
      window.open(anchor.href, "_blank", "noreferrer");
    }
    event.preventDefault();
  }
  onSelectionChange();
}

function captureEditorSelection(editor: HTMLDivElement | null): Range | null {
  if (!editor) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  if (!editor.contains(container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement)) return null;
  return range.cloneRange();
}

function restoreEditorSelection(editor: HTMLDivElement | null, range: Range | null): void {
  if (!editor) return;
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  if (
    range &&
    editor.contains(
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement,
    )
  ) {
    selection.addRange(range);
    return;
  }
  const fallback = document.createRange();
  fallback.selectNodeContents(editor);
  fallback.collapse(false);
  selection.addRange(fallback);
}

export function noteContentToHtml(content: string): string {
  if (!content.trim()) return "";
  if (/<(p|div|h[1-6]|ul|ol|li|blockquote|pre|strong|em|u|br|hr|input)\b/i.test(content)) {
    return sanitizeNoteHtml(content);
  }
  return content
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function sanitizeNoteHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son[a-z]+="[^"]*"/gi, "")
    .replace(/\son[a-z]+='[^']*'/gi, "")
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"');
}

export function htmlToPlainText(html: string): string {
  return sanitizeNoteHtml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
