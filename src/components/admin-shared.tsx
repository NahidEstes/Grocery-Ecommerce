"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { Upload, ImageIcon } from "lucide-react";
import { api } from "@/lib/client-api";
import { Modal } from "./ui";
import { useRouter } from "next/navigation";
const Context = createContext<{
  markDirty: () => void;
  clean: () => void;
  confirmLeave: () => Promise<boolean>;
}>({ markDirty: () => {}, clean: () => {}, confirmLeave: async () => true });
export function UnsavedProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [prompt, setPrompt] = useState(false),
    resolve = useRef<((value: boolean) => void) | null>(null),
    router = useRouter();
  function confirmLeave(): Promise<boolean> {
    if (!dirty) return Promise.resolve(true);
    if (resolve.current) return Promise.resolve(false);
    setPrompt(true);
    return new Promise((r) => {
      resolve.current = r;
    });
  }
  function settle(leave: boolean) {
    if (leave) setDirty(false);
    setPrompt(false);
    resolve.current?.(leave);
    resolve.current = null;
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const link = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (
        dirty &&
        a?.target !== "_blank" &&
        a?.getAttribute("href") &&
        !a.getAttribute("href")!.startsWith("#")
      ) {
        e.preventDefault();
        e.stopPropagation();
        const href = a.getAttribute("href")!;
        void confirmLeave().then((leave) => {
          if (leave) router.push(href);
        });
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", link, true);
    };
  }, [dirty]);
  return (
    <Context.Provider
      value={{
        markDirty: () => setDirty(true),
        clean: () => setDirty(false),
        confirmLeave,
      }}
    >
      {children}
      {prompt && (
        <Modal title="Unsaved changes" onClose={() => settle(false)}>
          <p className="modal-description">
            You have changes that have not been saved. Keep editing, or discard
            this draft and continue.
          </p>
          <div className="inline-actions">
            <button className="button primary" onClick={() => settle(false)}>
              Keep editing
            </button>
            <button className="button outline" onClick={() => settle(true)}>
              Discard changes
            </button>
          </div>
        </Modal>
      )}
    </Context.Provider>
  );
}
export const useUnsaved = () => useContext(Context);
export function ImageUploadField({
  initial = "",
  name = "imageUrl",
  label = "Image",
  onUrlChange,
  onBusyChange,
  isValidUrl,
  inputId,
  invalid,
  describedBy,
}: {
  initial?: string;
  name?: string;
  label?: string;
  onUrlChange?: (url: string) => void;
  onBusyChange?: (busy: boolean) => void;
  isValidUrl?: (url: string) => boolean;
  inputId?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [url, setUrl] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { markDirty } = useUnsaved();
  useEffect(() => setUrl(initial), [initial]);
  return (
    <div className="image-upload-field">
      <input
        type="hidden"
        name={`${name}-uploading`}
        value={busy ? "true" : "false"}
      />
      <label>
        {label} URL
        <input
          id={inputId}
          name={name}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            onUrlChange?.(e.target.value);
            markDirty();
          }}
          placeholder="Upload a photo or enter an HTTPS image URL"
          maxLength={2000}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      </label>
      <div className="image-upload-preview">
        {url && (!isValidUrl || isValidUrl(url)) ? (
          <img src={url} alt={`${label} preview`} />
        ) : (
          <ImageIcon size={32} />
        )}
        <label className="button outline small">
          <Upload size={16} />
          {busy ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError("");
              if (file.size > 2 * 1024 * 1024) {
                setError("Choose a PNG, JPEG or WebP image under 2 MB.");
                return;
              }
              setBusy(true);
              onBusyChange?.(true);
              try {
                const data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () =>
                    resolve(String(reader.result).split(",")[1]);
                  reader.onerror = () =>
                    reject(new Error("Could not read the photo."));
                  reader.readAsDataURL(file);
                });
                const result = await api<{ url: string }>("/admin/media", {
                  method: "POST",
                  body: JSON.stringify({ mime: file.type, data }),
                });
                setUrl(result.url);
                onUrlChange?.(result.url);
                markDirty();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
                onBusyChange?.(false);
              }
            }}
          />
        </label>
        <small>PNG, JPEG or WebP · up to 2 MB</small>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Notice({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <p className="form-error admin-feedback" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="success-message admin-feedback" role="status">
          {success}
        </p>
      )}
    </>
  );
}
