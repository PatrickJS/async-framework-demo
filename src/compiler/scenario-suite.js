import path from 'node:path';

import {
  createBoundaryInferenceRequest,
  discoverExtractableClosuresInProject,
  inferBoundaryManifestForProject,
  parseProjectFiles,
  validateBoundaryManifestForProject,
} from './closure-pipeline.js';

export const SCENARIOS = [
  scenario('01-direct-host-event', 'basic', {
    'src/App.tsx': `
type DirectButtonProps = { onPress: () => void };
export function DirectButton(props: DirectButtonProps) {
  return <button onClick={props.onPress}>Direct</button>;
}
export default function App() {
  return <DirectButton onPress={() => record("direct")} />;
}
`,
  }, ['DirectButton.onPress'], ['DirectButton.onPress']),

  scenario('02-destructured-prop', 'basic', {
    'src/App.tsx': `
type IconButtonProps = { onPress: () => void };
export function IconButton({ onPress }: IconButtonProps) {
  return <button onClick={onPress}>Icon</button>;
}
export default function App() {
  return <IconButton onPress={() => record("destructured")} />;
}
`,
  }, ['IconButton.onPress'], ['IconButton.onPress']),

  scenario('03-props-object', 'basic', {
    'src/App.tsx': `
type PropsObjectButtonProps = { onPress: () => void };
export function PropsObjectButton(props: PropsObjectButtonProps) {
  return <button onClick={props.onPress}>Object prop</button>;
}
export default function App() {
  return <PropsObjectButton onPress={() => record("props-object")} />;
}
`,
  }, ['PropsObjectButton.onPress'], ['PropsObjectButton.onPress']),

  scenario('04-renamed-destructuring', 'basic', {
    'src/App.tsx': `
type RenamedButtonProps = { onPress: () => void };
export function RenamedButton({ onPress: handlePress }: RenamedButtonProps) {
  return <button onClick={handlePress}>Renamed</button>;
}
export default function App() {
  return <RenamedButton onPress={() => record("renamed")} />;
}
`,
  }, ['RenamedButton.onPress'], ['RenamedButton.onPress']),

  scenario('05-same-file-wrapper', 'intermediate', {
    'src/App.tsx': `
type SameFileButtonProps = { onTrigger: () => void };
function SameFileButton({ onTrigger }: SameFileButtonProps) {
  return <button onClick={onTrigger}>Same file</button>;
}
export default function App() {
  return <SameFileButton onTrigger={() => record("same-file")} />;
}
`,
  }, ['SameFileButton.onTrigger'], ['SameFileButton.onTrigger']),

  scenario('06-cross-file-wrapper', 'intermediate', {
    'src/App.tsx': `
import { CrossFileButton } from "./CrossFileButton";
export default function App() {
  return <CrossFileButton onPress={() => record("cross-file")} />;
}
`,
    'src/CrossFileButton.tsx': `
type CrossFileButtonProps = { onPress: () => void };
export function CrossFileButton({ onPress }: CrossFileButtonProps) {
  return <button onClick={onPress}>Cross file</button>;
}
`,
  }, ['CrossFileButton.onPress'], ['CrossFileButton.onPress']),

  scenario('07-two-hop-forwarding', 'intermediate', {
    'src/App.tsx': `
type ActionButtonProps = { onTrigger: () => void };
function ActionButton({ onTrigger }: ActionButtonProps) {
  return <button onClick={onTrigger}>Trigger</button>;
}
type ActionPanelProps = { onAction: () => void };
export function ActionPanel({ onAction }: ActionPanelProps) {
  return <ActionButton onTrigger={onAction} />;
}
export default function App() {
  return <ActionPanel onAction={() => record("two-hop")} />;
}
`,
  }, ['ActionButton.onTrigger', 'ActionPanel.onAction'], ['ActionPanel.onAction']),

  scenario('08-three-hop-forwarding', 'advanced', {
    'src/App.tsx': `
type LeafButtonProps = { onTap: () => void };
function LeafButton({ onTap }: LeafButtonProps) {
  return <button onClick={onTap}>Leaf</button>;
}
type MiddleActionProps = { onRun: () => void };
function MiddleAction({ onRun }: MiddleActionProps) {
  return <LeafButton onTap={onRun} />;
}
type DeepPanelProps = { onCommit: () => void };
export function DeepPanel({ onCommit }: DeepPanelProps) {
  return <MiddleAction onRun={onCommit} />;
}
export default function App() {
  return <DeepPanel onCommit={() => record("three-hop")} />;
}
`,
  }, ['DeepPanel.onCommit', 'LeafButton.onTap', 'MiddleAction.onRun'], ['DeepPanel.onCommit']),

  scenario('09-multiple-host-events', 'intermediate', {
    'src/App.tsx': `
type PointerSurfaceProps = {
  onEnter: () => void;
  onLeave: () => void;
  onMove: () => void;
};
export function PointerSurface({ onEnter, onLeave, onMove }: PointerSurfaceProps) {
  return <div onMouseEnter={onEnter} onMouseLeave={onLeave} onMouseMove={onMove}>Pointer</div>;
}
export default function App() {
  return (
    <PointerSurface
      onEnter={() => record("enter")}
      onLeave={() => record("leave")}
      onMove={() => record("move")}
    />
  );
}
`,
  }, ['PointerSurface.onEnter', 'PointerSurface.onLeave', 'PointerSurface.onMove'], [
    'PointerSurface.onEnter',
    'PointerSurface.onLeave',
    'PointerSurface.onMove',
  ]),

  scenario('10-form-submit', 'intermediate', {
    'src/App.tsx': `
type SubmitFormProps = { onSubmit: (event: unknown) => void };
export function SubmitForm({ onSubmit }: SubmitFormProps) {
  return <form onSubmit={onSubmit}><button type="submit">Submit</button></form>;
}
export default function App() {
  return <SubmitForm onSubmit={(event) => record(event)} />;
}
`,
  }, ['SubmitForm.onSubmit'], ['SubmitForm.onSubmit']),

  scenario('11-import-alias', 'intermediate', {
    'src/App.tsx': `
import { LibraryButton as AliasButton } from "./LibraryButton";
export default function App() {
  return <AliasButton onPress={() => record("alias")} />;
}
`,
    'src/LibraryButton.tsx': `
type LibraryButtonProps = { onPress: () => void };
export function LibraryButton({ onPress }: LibraryButtonProps) {
  return <button onClick={onPress}>Alias</button>;
}
`,
  }, ['LibraryButton.onPress'], ['LibraryButton.onPress']),

  scenario('12-default-import', 'intermediate', {
    'src/App.tsx': `
import DefaultButton from "./DefaultButton";
export default function App() {
  return <DefaultButton onPress={() => record("default")} />;
}
`,
    'src/DefaultButton.tsx': `
type DefaultButtonProps = { onPress: () => void };
export default function DefaultButton({ onPress }: DefaultButtonProps) {
  return <button onClick={onPress}>Default</button>;
}
`,
  }, ['DefaultButton.onPress'], ['DefaultButton.onPress']),

  scenario('13-nested-same-file-forwarding', 'advanced', {
    'src/App.tsx': `
type InnerActionProps = { onTap: () => void };
function InnerAction({ onTap }: InnerActionProps) {
  return <button onClick={onTap}>Tap</button>;
}
type OuterPanelProps = { onAction: () => void };
export function OuterPanel({ onAction }: OuterPanelProps) {
  return <InnerAction onTap={onAction} />;
}
export default function App() {
  return <OuterPanel onAction={() => record("outer")} />;
}
`,
  }, ['InnerAction.onTap', 'OuterPanel.onAction'], ['OuterPanel.onAction']),

  scenario('14-two-positive-props', 'advanced', {
    'src/App.tsx': `
type SplitPanelProps = {
  onConfirm: () => void;
  onCancel: () => void;
};
export function SplitPanel({ onConfirm, onCancel }: SplitPanelProps) {
  return <div><button onClick={onConfirm}>Confirm</button><button onClick={onCancel}>Cancel</button></div>;
}
export default function App() {
  return <SplitPanel onConfirm={() => record("confirm")} onCancel={() => record("cancel")} />;
}
`,
  }, ['SplitPanel.onCancel', 'SplitPanel.onConfirm'], ['SplitPanel.onCancel', 'SplitPanel.onConfirm']),

  scenario('15-mixed-positive-and-unknown', 'advanced', {
    'src/App.tsx': `
type MixedPanelProps = {
  onSubmit: () => void;
  renderBadge: () => unknown;
};
export function MixedPanel({ onSubmit, renderBadge }: MixedPanelProps) {
  return <section><button onClick={onSubmit}>Submit</button>{renderBadge()}</section>;
}
export default function App() {
  return <MixedPanel onSubmit={() => record("submit")} renderBadge={() => "badge"} />;
}
`,
  }, ['MixedPanel.onSubmit'], ['MixedPanel.onSubmit'], ['MixedPanel.renderBadge']),

  scenario('16-command-bar', 'advanced', {
    'src/App.tsx': `
type CommandButtonProps = { onRun: () => void };
function CommandButton({ onRun }: CommandButtonProps) {
  return <button onClick={onRun}>Run</button>;
}
type DangerButtonProps = { onConfirm: () => void };
function DangerButton({ onConfirm }: DangerButtonProps) {
  return <button onClick={onConfirm}>Danger</button>;
}
type CommandBarProps = {
  onSave: () => void;
  onPublish: () => void;
  onArchive: () => void;
};
export function CommandBar({ onSave, onPublish, onArchive }: CommandBarProps) {
  return (
    <div>
      <CommandButton onRun={onSave} />
      <CommandButton onRun={onPublish} />
      <DangerButton onConfirm={onArchive} />
    </div>
  );
}
export default function App() {
  return (
    <CommandBar
      onSave={() => record("save")}
      onPublish={() => record("publish")}
      onArchive={() => record("archive")}
    />
  );
}
`,
  }, [
    'CommandBar.onArchive',
    'CommandBar.onPublish',
    'CommandBar.onSave',
    'CommandButton.onRun',
    'DangerButton.onConfirm',
  ], ['CommandBar.onArchive', 'CommandBar.onPublish', 'CommandBar.onSave']),

  scenario('17-render-callback-negative', 'negative', {
    'src/App.tsx': `
type RenderBoxProps = { renderItem: () => unknown };
export function RenderBox({ renderItem }: RenderBoxProps) {
  return <section>{renderItem()}</section>;
}
export default function App() {
  return <RenderBox renderItem={() => "item"} />;
}
`,
  }, [], [], ['RenderBox.renderItem']),

  scenario('18-computation-callback-negative', 'negative', {
    'src/App.tsx': `
type CalculatorProps = { compute: () => number };
export function Calculator({ compute }: CalculatorProps) {
  const value = compute();
  return <output>{value}</output>;
}
export default function App() {
  return <Calculator compute={() => 42} />;
}
`,
  }, [], [], ['Calculator.compute']),

  scenario('19-aliased-handler-ambiguous', 'ambiguous', {
    'src/App.tsx': `
type MaybeButtonProps = { onMaybe: () => void };
export function MaybeButton({ onMaybe }: MaybeButtonProps) {
  const handler = onMaybe;
  return <button onClick={handler}>Maybe</button>;
}
export default function App() {
  return <MaybeButton onMaybe={() => record("maybe")} />;
}
`,
  }, [], [], ['MaybeButton.onMaybe']),

  scenario('20-deferred-prop-ambiguous', 'ambiguous', {
    'src/App.tsx': `
type DeferredPanelProps = { onDeferred: () => void };
export function DeferredPanel({ onDeferred }: DeferredPanelProps) {
  queueMicrotask(onDeferred);
  return <section>Deferred</section>;
}
export default function App() {
  return <DeferredPanel onDeferred={() => record("deferred")} />;
}
`,
  }, [], [], ['DeferredPanel.onDeferred']),
];

export const evaluateScenario = (scenarioRecord) => {
  const rootDir = path.resolve('/tmp/async-framework-demo-scenarios', scenarioRecord.id);
  const fileEntries = Object.entries(scenarioRecord.files).map(([filename, source]) => ({
    filename: path.join(rootDir, filename),
    source,
  }));
  const project = parseProjectFiles(fileEntries, rootDir);
  const inference = inferBoundaryManifestForProject(project);
  validateBoundaryManifestForProject(project, inference.manifest);
  const closures = discoverExtractableClosuresInProject(project, inference.manifest);
  const request = createBoundaryInferenceRequest(project);
  const actualBoundaries = manifestBoundaryEntries(inference.manifest);
  const actualExtractableClosures = closures.map((closure) => closure.target).sort();
  const actualUnknowns = unknownClosureLabels(request, inference.manifest);

  return {
    ...scenarioRecord,
    manifest: inference.manifest,
    actualBoundaries,
    actualExtractableClosures,
    actualUnknowns,
  };
};

export const boundaryLabels = (boundaries) => {
  return boundaries.map((boundary) => `${boundary.component}.${boundary.prop}`).sort();
};

export const expectedBoundaryEntries = (scenarios) => {
  return scenarios.flatMap((scenarioRecord) => scenarioRecord.expectedBoundaries);
};

export const expectedUnknownEntries = (scenarios) => {
  return scenarios.flatMap((scenarioRecord) => scenarioRecord.expectedUnknowns);
};

export const scenarioResultSummary = (result) => {
  return {
    id: result.id,
    category: result.category,
    expectedBoundaryCount: result.expectedBoundaries.length,
    expectedExtractableClosureCount: result.expectedExtractableClosures.length,
    expectedUnknownCount: result.expectedUnknowns.length,
  };
};

function scenario(
  id,
  category,
  files,
  expectedBoundaries,
  expectedExtractableClosures,
  expectedUnknowns = [],
) {
  return {
    id,
    category,
    files,
    expectedBoundaries: [...expectedBoundaries].sort(),
    expectedExtractableClosures: [...expectedExtractableClosures].sort(),
    expectedUnknowns: [...expectedUnknowns].sort(),
  };
}

const manifestBoundaryEntries = (manifest) => {
  const entries = [];

  for (const [component, record] of Object.entries(manifest.components ?? {})) {
    for (const [prop, kind] of Object.entries(record.props ?? {})) {
      entries.push({
        component,
        prop,
        kind,
        evidence: record.evidence?.[prop] ?? [],
      });
    }
  }

  return entries.sort((left, right) => {
    const byComponent = left.component.localeCompare(right.component);
    return byComponent || left.prop.localeCompare(right.prop);
  });
};

const unknownClosureLabels = (request, manifest) => {
  return request.condensedAst.closureSites
    .filter((site) => {
      const target = site.targetComponent ?? site.targetTag;
      return manifest.components?.[target]?.props?.[site.prop] === undefined;
    })
    .map((site) => `${site.targetComponent ?? site.targetTag}.${site.prop}`)
    .sort();
};
