"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITIONS,
  type Category,
  type Condition,
} from "@/convex/lib/constants";
import { preparePhoto } from "./preparePhoto";
import { Badge, Button, Empty, ErrorText, inputClass, useAction } from "./ui";

type MyTool = FunctionReturnType<typeof api.tools.mine>[number];
type Draft = {
  name: string;
  category: Category;
  condition: Condition;
  description: string;
  neighborhood: string;
};
const EMPTY: Draft = {
  name: "",
  category: "power_tools",
  condition: "good",
  description: "",
  neighborhood: "",
};

// Mirrors the server's rules so people get instant feedback; the server still enforces them.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function MyListings() {
  const tools = useQuery(api.tools.mine);
  const remove = useMutation(api.tools.remove);
  const [editing, setEditing] = useState<MyTool | null>(null);
  const action = useAction();

  return (
    <section className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
      <ToolForm key={editing?._id ?? "new"} editing={editing} onDone={() => setEditing(null)} />

      <div>
        <h2 className="mb-3 font-medium">Your tools</h2>
        <ErrorText error={action.error} />
        {tools === undefined ? (
          <p className="text-muted">Loading…</p>
        ) : tools.length === 0 ? (
          <Empty>You haven&apos;t listed anything yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {tools.map((tool) => (
              <li
                key={tool._id}
                className="flex gap-3 rounded-card border border-line bg-surface shadow-card p-3"
              >
                {tool.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are signed per request
                  <img src={tool.photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-paper" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/tools/${tool._id}`}
                      className="font-medium hover:underline"
                    >
                      {tool.name}
                    </Link>
                    <Badge tone={tool.availability.status}>
                      {tool.availability.status === "available" ? "Available" : "On loan"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {CATEGORY_LABELS[tool.category]} · {tool.condition}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="ghost" onClick={() => setEditing(tool)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      disabled={action.pending}
                      onClick={() => {
                        if (confirm(`Delete "${tool.name}"?`))
                          action.run(() => remove({ toolId: tool._id }));
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ToolForm({ editing, onDone }: { editing: MyTool | null; onDone: () => void }) {
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const generateUploadUrl = useMutation(api.tools.generateUploadUrl);
  // The saved photo (when editing), a newly picked file, or neither.
  const [photoId, setPhotoId] = useState<Id<"_storage"> | undefined>(editing?.photoId);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(editing?.photoUrl ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const [draft, setDraft] = useState<Draft>(
    editing
      ? {
          name: editing.name,
          category: editing.category,
          condition: editing.condition,
          description: editing.description,
          neighborhood: editing.neighborhood ?? "",
        }
      : EMPTY,
  );
  const action = useAction();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form
      className="space-y-3 rounded-card border border-line bg-surface shadow-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await action.run(async () => {
          let finalPhotoId = photoId;
          if (file) {
            const photo = await preparePhoto(file);
            const uploadUrl = await generateUploadUrl();
            const res = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": photo.type },
              body: photo,
            });
            if (!res.ok) throw new Error("Photo upload failed");
            finalPhotoId = ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
          }
          const fields = { ...draft, photoId: finalPhotoId };
          await (editing ? update({ toolId: editing._id, ...fields }) : create(fields));
        });
        if (ok) {
          setDraft(EMPTY);
          setFile(null);
          setPhotoId(undefined);
          setPreview(null);
          onDone();
        }
      }}
    >
      <h2 className="font-medium">{editing ? "Edit tool" : "List a tool"}</h2>
      <label className="block text-sm">
        Name
        <input
          required
          maxLength={80}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          Category
          <select
            value={draft.category}
            onChange={(e) => set("category", e.target.value as Category)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Condition
          <select
            value={draft.condition}
            onChange={(e) => set("condition", e.target.value as Condition)}
            className={inputClass}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Neighborhood
        <input
          required
          maxLength={60}
          placeholder="e.g. Bole"
          value={draft.neighborhood}
          onChange={(e) => set("neighborhood", e.target.value)}
          className={inputClass}
        />
        <span className="text-xs text-muted">
          Just the area, never your address. You share pickup details only when you approve someone.
        </span>
      </label>
      <label className="block text-sm">
        Short description
        <textarea
          required
          maxLength={500}
          rows={3}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="text-sm">
        Photo (optional)
        <div className="mt-1 flex items-center gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview or signed Convex URL
            <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
          )}
          <input
            type="file"
            accept={PHOTO_TYPES.join(",")}
            aria-label="Photo"
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              setFileError(null);
              if (!picked) return;
              if (!PHOTO_TYPES.includes(picked.type) || picked.size > MAX_PHOTO_BYTES) {
                setFileError("Choose a JPEG, PNG or WebP image under 5 MB.");
                e.target.value = "";
                return;
              }
              setFile(picked);
              setPreview(URL.createObjectURL(picked));
            }}
            className="text-xs"
          />
          {preview && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFile(null);
                setPhotoId(undefined);
                setPreview(null);
              }}
            >
              Remove
            </Button>
          )}
        </div>
        <ErrorText error={fileError} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={action.pending}>
          {editing ? "Save changes" : "List tool"}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
      <ErrorText error={action.error} />
    </form>
  );
}
