import { Check } from "lucide-react";
import type { EditorSection } from "../../utils/appViewUtils";
import { classes } from "../../styles";

type Props = {
  complete: Record<EditorSection, boolean>;
  onSelect: (section: EditorSection) => void;
};

const sections: Array<[EditorSection, string]> = [
  ["route", "Route"],
  ["fuel", "Fuel"],
  ["people", "Riders"],
];

export function WorkflowNavigator({ complete, onSelect }: Props) {
  return (
    <nav className={classes("workflow-nav")} aria-label="Trip sections">
      {sections.map(([section, label], index) => (
        <button
          key={section}
          type="button"
          onClick={() => onSelect(section)}
          aria-label={`${label}, ${complete[section] ? "complete" : "incomplete"}`}
        >
          <span>
            {complete[section] ? <Check aria-hidden="true" /> : index + 1}
          </span>
          {label}
        </button>
      ))}
      <a href="#assignments">Assign</a>
      <a href="#results">Split</a>
    </nav>
  );
}
