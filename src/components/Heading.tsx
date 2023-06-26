import { component$ } from "@builder.io/qwik";
import { db } from "~/database/main";
import { Project } from "~/database/tables/project";
import { css } from "~/panda/css";

const isValid = (name: string) => {
  return name.length > 0 && name.length < 256;
};

// TODO: consider just using an input element, see google docs as an example
export const EditableHeading = component$<{ project: Project }>(({ project }) => {
  return (
    <h1
      aria-label="Project name"
      contentEditable="true"
      class={css({
        w: "full",
        fontSize: "2xl",
        fontWeight: "extrabold",
        outlineColor: "transparent",
        lineHeight: "tight",
      })}
      onBlur$={(event) => {
        const next = event.target.textContent;

        if (!isValid(next ?? "")) {
          event.target.textContent = project.name;
          return;
        }

        db.projects.where({ id: project.id }).modify({ name: next });
      }}
    >
      {project.name}
    </h1>
  );
});
