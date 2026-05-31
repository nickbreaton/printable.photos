import { createEffect, createMemo, createSignal } from "solid-js";
import { Plus, Settings } from "lucide-static";

import { Button } from "../ui/Button";
import { Dropdown } from "../ui/Dropdown";
import { Icon } from "../ui/Icon";
import { projectId, projects, selectProject } from "../../state";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

export function HeaderProjectDropdown() {
  const [settingsDialogRef, setSettingsDialogRef] = createSignal<HTMLDialogElement>();
  const [settingsMode, setSettingsMode] = createSignal<"create" | "settings" | null>(null);
  const options = createMemo(() => {
    return projects.map((project) => ({ label: project.name, value: project.id }));
  });

  createEffect(
    () => {
      if (!settingsMode()) return undefined;

      return settingsDialogRef();
    },
    (dialog) => {
      if (!dialog || dialog.open) return;

      dialog.showModal();
    },
  );

  return (
    <div class="flex items-center gap-2">
      <Dropdown
        options={options()}
        actions={[
          {
            icon: Plus,
            label: "Create new project",
            onClick: () => setSettingsMode("create"),
          },
        ]}
        value={projectId()}
        onSelect={(id) => selectProject(id)}
      />
      <Button
        type="button"
        variant="secondary"
        activeTransform={false}
        size="icon"
        aria-label="Project settings"
        onClick={() => setSettingsMode("settings")}
      >
        <Icon icon={Settings} />
      </Button>
      <ProjectSettingsDialog
        ref={setSettingsDialogRef}
        open={Boolean(settingsMode())}
        mode={settingsMode() ?? "settings"}
        onClose={() => {
          setSettingsMode(null);
          if (settingsDialogRef()?.open) settingsDialogRef()?.close();
        }}
      />
    </div>
  );
}

