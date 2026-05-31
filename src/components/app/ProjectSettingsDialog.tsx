import { createMemo, createSignal, Show } from "solid-js";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { FieldLabel } from "../ui/FieldLabel";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { Trash2 } from "lucide-static";
import { createProject, deleteProject, project, projects, renameProject } from "../../state";

export function ProjectSettingsDialog(props: {
  ref: (element: HTMLDialogElement) => void;
  open: boolean;
  mode: "create" | "settings";
  onClose: () => void;
}) {
  const [name, setName] = createSignal(() => (props.mode === "create" ? "" : project().name));
  const canDeleteProject = createMemo(() => projects.length > 1);

  async function saveProjectName() {
    const nextName = name().trim();

    if (!nextName) return;

    if (props.mode === "create") {
      await createProject(nextName);
    } else {
      await renameProject(project().id, nextName);
    }

    props.onClose();
  }

  async function deleteCurrentProject() {
    if (!canDeleteProject()) return;
    if (!window.confirm(`Delete “${project().name}”? This cannot be undone.`)) return;

    await deleteProject(project().id);
    props.onClose();
  }

  return (
    <Dialog ref={props.ref} class="w-[calc(100vw-2.5rem)] max-w-md" onClose={props.onClose}>
      <form
        class="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void saveProjectName();
        }}
      >
        <h2 class="text-xl font-semibold">
          {props.mode === "create" ? "Create project" : "Project settings"}
        </h2>
        <div class="min-h-24">
          <FieldLabel>
            Project name
            <Input
              value={name()}
              autofocus
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </FieldLabel>
        </div>
        <div class="flex items-center justify-end gap-3">
          <Show when={props.mode === "settings"}>
            <Button
              type="button"
              variant="secondary"
              class="mr-auto gap-2"
              disabled={!canDeleteProject()}
              onClick={deleteCurrentProject}
            >
              <Icon icon={Trash2} />
              Delete project
            </Button>
          </Show>
          <Button type="button" variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name().trim()}>
            {props.mode === "create" ? "Create" : "Rename"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

