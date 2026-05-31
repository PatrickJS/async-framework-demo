import path from 'node:path';

const SOURCE_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'];
const BOUNDARY_KINDS = new Set(['event', 'server', 'resource']);

export class DeterministicMockClassifier {
  constructor(fixtureDocument = {}) {
    this.fixtures = new Map();
    for (const fixture of fixtureDocument.fixtures ?? []) {
      this.fixtures.set(fixture.id, fixture.output);
    }
  }

  classifyBoundary(candidate) {
    const output = this.fixtures.get(candidate.id);
    if (output) return { ...output };

    if (candidate.tag && isHostEventAttribute(candidate.tag, candidate.attribute)) {
      return { kind: 'event', confidence: 'high' };
    }

    return { kind: 'unknown', confidence: 'none' };
  }
}

export const parseProjectFiles = (fileEntries, rootDir) => {
  return fileEntries
    .filter((entry) => SOURCE_EXTENSIONS.includes(path.extname(entry.filename)))
    .map((entry) => {
      const absolutePath = path.resolve(entry.filename);
      return {
        filename: normalizePath(path.relative(rootDir, absolutePath)),
        absolutePath,
        source: entry.source,
      };
    })
    .sort((left, right) => left.filename.localeCompare(right.filename));
};

export const inferBoundaryManifestForProject = (
  project,
  classifier = new DeterministicMockClassifier(),
) => {
  const graph = buildProjectGraph(project);
  const edges = collectBoundaryEdges(graph);
  const classifierDecisions = [];
  const boundaries = inferBoundariesFromEdges(edges, classifier, classifierDecisions);

  return {
    manifest: manifestFromBoundaries(boundaries),
    diagnostics: {
      parser: 'tsx-fact-extractor',
      files: project.map((file) => file.filename),
      componentCount: graph.components.size,
      edgeCount: edges.length,
      astEdges: edges,
      classifierDecisions,
    },
  };
};

export const createBoundaryInferenceRequest = (project, options = {}) => {
  const condensedAst = createCondensedAstForProject(project);
  const targetCandidateIds = options.candidateIds
    ?? condensedAst.candidates.map((candidate) => candidate.id);

  return {
    schemaVersion: 1,
    task: 'infer-boundary-manifest-patch',
    parser: 'tsx-fact-extractor',
    instructions: [
      'Use the condensed TSX/JSX facts to recursively trace closure candidates across files.',
      'Lowercase JSX tags are host elements. Host on* attributes are event boundaries.',
      'For each targetCandidateId, add the candidate target component prop when its trace reaches a host on* boundary.',
      'Return only a manifest patch for boundaries supported by the trace.',
      'Use unknown when the trace is missing, cyclic, or ambiguous.',
      'If manifestPatch.components is non-empty, decision must be add_to_whitelist.',
    ],
    targetCandidateIds,
    condensedAst,
  };
};

export const createCondensedAstForProject = (project) => {
  const graph = buildProjectGraph(project);
  const propForwardingEdges = collectBoundaryEdges(graph);
  const closureSites = collectClosureSites(graph);

  return {
    schemaVersion: 1,
    files: project.map((file) => condenseFile(graph, file)),
    propForwardingEdges,
    closureSites,
    candidates: closureSites.map((site) => ({
      id: site.id,
      file: site.file,
      component: site.component,
      target: `${site.targetComponent ?? site.targetTag}.${site.prop}`,
      valueKind: site.valueKind,
      question: `Should closure ${site.id} add ${site.targetComponent ?? site.targetTag}.${site.prop} to the boundary manifest?`,
    })),
  };
};

export const discoverExtractableClosuresInProject = (project, manifest) => {
  const graph = buildProjectGraph(project);
  const reports = [];

  for (const component of graph.components.values()) {
    for (const element of collectJsxElements(component)) {
      const target = resolveJsxTarget(graph, component.file, element.tag);
      if (target.kind !== 'component') continue;

      const componentManifest = manifest.components?.[target.componentName];
      if (!componentManifest) continue;

      for (const attribute of element.attributes) {
        const boundaryKind = componentManifest.props?.[attribute.name];
        if (!boundaryKind || !isClosureExpressionText(attribute.expression)) continue;

        reports.push({
          file: component.file.filename,
          component: component.name,
          target: `${target.componentName}.${attribute.name}`,
          boundaryKind,
          loc: locOf(component.file.source, attribute.expressionStart),
          span: {
            start: attribute.expressionStart,
            end: attribute.expressionEnd,
          },
          source: attribute.expression,
        });
      }
    }
  }

  return reports.sort(sortByFileAndSpan);
};

export const validateBoundaryManifestForProject = (project, manifest) => {
  if (!manifest || manifest.schemaVersion !== 1 || typeof manifest.components !== 'object') {
    throw new Error('Boundary manifest must use schemaVersion 1 with a components object.');
  }

  const request = createBoundaryInferenceRequest(project);
  const findEvidencePath = createEvidencePathFinder(request);
  const accepted = [];

  for (const [component, componentRecord] of Object.entries(manifest.components)) {
    for (const [prop, kind] of Object.entries(componentRecord.props ?? {})) {
      if (!BOUNDARY_KINDS.has(kind)) {
        throw new Error(`Unsupported boundary kind for ${component}.${prop}: ${kind}`);
      }

      const compilerEvidence = findEvidencePath(component, prop);
      if (!compilerEvidence) {
        throw new Error(`${component}.${prop} does not have compiler evidence.`);
      }

      const manifestEvidence = componentRecord.evidence?.[prop];
      if (!Array.isArray(manifestEvidence)) {
        throw new Error(`${component}.${prop} is missing manifest evidence.`);
      }

      if (stableJsonInline(manifestEvidence) !== stableJsonInline(compilerEvidence)) {
        throw new Error(`${component}.${prop} manifest evidence does not match compiler evidence.`);
      }

      accepted.push({ component, prop, kind });
    }
  }

  accepted.sort(sortBoundaryRecord);
  return { accepted };
};

export const decisionToManifest = (decision, request = null) => {
  const manifest = { schemaVersion: 1, components: {} };
  if (decision.decision !== 'add_to_whitelist') return manifest;
  if (!request) {
    throw new Error('Boundary manifest conversion requires the condensed AST request for evidence derivation.');
  }

  const findEvidencePath = createEvidencePathFinder(request);

  for (const entry of decision.manifestPatch?.components ?? []) {
    if (entry.kind === 'unknown') continue;
    const evidence = findEvidencePath(entry.component, entry.prop);
    if (entry.kind === 'event' && !evidence) continue;

    manifest.components[entry.component] ??= { props: {}, evidence: {} };
    manifest.components[entry.component].props[entry.prop] = entry.kind;
    manifest.components[entry.component].evidence[entry.prop] = evidence;
  }

  return manifest;
};

export const stableJson = (value) => `${JSON.stringify(sortJson(value), null, 2)}\n`;

export const createEvidencePathFinder = (request) => {
  const edgesBySource = indexPropForwardingEdges(request?.condensedAst?.propForwardingEdges);

  return (component, prop) => findEventEvidencePath(edgesBySource, component, prop, new Set());
};

const buildProjectGraph = (project) => {
  const filesByPath = new Map(project.map((file) => [file.absolutePath, file]));
  const modules = new Map();
  const components = new Map();

  for (const file of project) {
    const moduleInfo = {
      file,
      imports: collectImports(file, filesByPath),
      exports: new Map(),
    };
    modules.set(file.absolutePath, moduleInfo);

    for (const component of collectComponents(file)) {
      components.set(componentKey(file.absolutePath, component.name), component);
      if (component.exported) moduleInfo.exports.set(component.exportName, component.name);
    }
  }

  return { files: project, modules, components };
};

const collectBoundaryEdges = (graph) => {
  const edges = [];

  for (const component of graph.components.values()) {
    const propBindings = collectPropBindings(component.params);

    for (const element of collectJsxElements(component)) {
      const target = resolveJsxTarget(graph, component.file, element.tag);

      for (const attribute of element.attributes) {
        const sourceProp = propReference(attribute.expression, propBindings);
        if (!attribute.name || !sourceProp) continue;

        edges.push({
          sourceFile: component.file.filename,
          component: component.name,
          prop: sourceProp,
          targetFile: target.file?.filename ?? null,
          targetTag: element.tag,
          targetComponent: target.componentName ?? null,
          targetProp: attribute.name,
          targetKind: target.kind,
          span: { start: attribute.start, end: attribute.end },
        });
      }
    }
  }

  return edges.sort(sortEdge);
};

const collectClosureSites = (graph) => {
  const closureSites = [];

  for (const component of graph.components.values()) {
    for (const element of collectJsxElements(component)) {
      const target = resolveJsxTarget(graph, component.file, element.tag);

      for (const attribute of element.attributes) {
        if (!attribute.name || !isClosureExpressionText(attribute.expression)) continue;

        closureSites.push({
          id: `closure:${component.file.filename}:${attribute.expressionStart}:${attribute.expressionEnd}`,
          file: component.file.filename,
          component: component.name,
          targetTag: element.tag,
          targetKind: target.kind,
          targetComponent: target.componentName ?? null,
          targetFile: target.file?.filename ?? null,
          prop: attribute.name,
          valueKind: closureValueKind(attribute.expression),
          loc: locOf(component.file.source, attribute.expressionStart),
          span: {
            start: attribute.expressionStart,
            end: attribute.expressionEnd,
          },
          source: attribute.expression,
        });
      }
    }
  }

  return closureSites.sort(sortByFileAndSpan);
};

const condenseFile = (graph, file) => {
  const moduleInfo = graph.modules.get(file.absolutePath);
  const components = [...graph.components.values()]
    .filter((component) => component.file.absolutePath === file.absolutePath)
    .map((component) => condenseComponent(graph, component));

  return {
    path: file.filename,
    imports: [...(moduleInfo?.imports ?? new Map()).entries()].map(([localName, imported]) => ({
      localName,
      from: graph.modules.get(imported.modulePath)?.file.filename ?? null,
      exportName: imported.exportName,
    })),
    exports: [...(moduleInfo?.exports ?? new Map()).entries()].map(([exportName, localName]) => ({
      exportName,
      localName,
    })),
    components,
  };
};

const condenseComponent = (graph, component) => {
  const propBindings = collectPropBindings(component.params);
  const jsxElements = collectJsxElements(component).map((element) => {
    const target = resolveJsxTarget(graph, component.file, element.tag);
    return {
      tag: element.tag,
      targetKind: target.kind,
      targetComponent: target.componentName ?? null,
      targetFile: target.file?.filename ?? null,
      attributes: element.attributes.map((attribute) => condenseJsxAttribute(attribute, propBindings)),
    };
  });

  return {
    name: component.name,
    exported: component.exported,
    exportName: component.exportName,
    props: [...propBindings.entries()].map(([bindingName, binding]) => ({
      bindingName,
      kind: binding.kind,
      prop: binding.prop ?? null,
    })),
    jsxElements,
  };
};

const condenseJsxAttribute = (attribute, propBindings) => {
  const record = {
    name: attribute.name,
    valueKind: attribute.expression ? closureValueKind(attribute.expression) : 'boolean',
    propReference: propReference(attribute.expression, propBindings),
    span: { start: attribute.start, end: attribute.end },
  };

  if (isClosureExpressionText(attribute.expression)) {
    record.closure = {
      valueKind: closureValueKind(attribute.expression),
      source: attribute.expression,
    };
  }

  return record;
};

const inferBoundariesFromEdges = (edges, classifier, classifierDecisions) => {
  const boundaries = new Map();
  let changed = true;

  while (changed) {
    changed = false;
    for (const edge of edges) {
      let kind = null;
      let reason = null;
      let evidence = null;

      if (edge.targetKind === 'host') {
        const candidate = {
          id: `jsx-attribute:${edge.targetTag}:${edge.targetProp}`,
          file: edge.sourceFile,
          tag: edge.targetTag,
          attribute: edge.targetProp,
          propagatedTo: `${edge.component}.${edge.prop}`,
          reason: 'TSX facts show a component prop is wired into this host JSX attribute.',
        };
        const decision = classifier.classifyBoundary(candidate);
        classifierDecisions.push({ candidate, decision });

        if (decision.kind !== 'unknown') {
          kind = decision.kind;
          reason = `classifier ${candidate.id}`;
          evidence = [`${edge.component}.${edge.prop}`, `${edge.targetTag}.${edge.targetProp}`];
        }
      } else if (edge.targetKind === 'component' && edge.targetComponent) {
        const propagated = boundaries.get(boundaryKey(edge.targetComponent, edge.targetProp));
        if (propagated) {
          kind = propagated.kind;
          reason = `${edge.targetComponent}.${edge.targetProp}`;
          evidence = [`${edge.component}.${edge.prop}`, ...propagated.evidence];
        }
      }

      if (!kind) continue;

      const key = boundaryKey(edge.component, edge.prop);
      if (!boundaries.has(key)) {
        boundaries.set(key, {
          component: edge.component,
          prop: edge.prop,
          kind,
          reason,
          evidence,
        });
        changed = true;
      }
    }
  }

  return boundaries;
};

const manifestFromBoundaries = (boundaries) => {
  const manifest = { schemaVersion: 1, components: {} };
  const sorted = [...boundaries.values()].sort(sortBoundaryRecord);

  for (const boundary of sorted) {
    manifest.components[boundary.component] ??= { props: {}, evidence: {} };
    manifest.components[boundary.component].props[boundary.prop] = boundary.kind;
    manifest.components[boundary.component].evidence[boundary.prop] = boundary.evidence;
  }

  return manifest;
};

const collectComponents = (file) => {
  const components = [
    ...collectFunctionComponents(file),
    ...collectArrowComponents(file),
  ];

  return components
    .filter((component) => isComponentName(component.name))
    .sort((left, right) => left.start - right.start);
};

const collectFunctionComponents = (file) => {
  const components = [];
  const pattern = /(?:^|\n)\s*(export\s+)?(?:(default)\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  let match;

  while ((match = pattern.exec(file.source))) {
    const bodyStart = pattern.lastIndex - 1;
    const bodyEnd = findMatching(file.source, bodyStart, '{', '}');
    if (bodyEnd < 0) continue;

    const exported = Boolean(match[1]);
    const exportName = match[2] === 'default' ? 'default' : match[3];
    components.push({
      file,
      name: match[3],
      params: match[4],
      body: file.source.slice(bodyStart + 1, bodyEnd),
      bodyStart,
      bodyEnd: bodyEnd + 1,
      start: match.index,
      exported,
      exportName,
    });
  }

  return components;
};

const collectArrowComponents = (file) => {
  const components = [];
  const pattern = /(?:^|\n)\s*(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>\s*/g;
  let match;

  while ((match = pattern.exec(file.source))) {
    const bodyStart = skipWhitespace(file.source, pattern.lastIndex);
    let bodyEnd = -1;
    let body;

    if (file.source[bodyStart] === '{') {
      bodyEnd = findMatching(file.source, bodyStart, '{', '}');
      if (bodyEnd < 0) continue;
      body = file.source.slice(bodyStart + 1, bodyEnd);
    } else {
      bodyEnd = findExpressionEnd(file.source, bodyStart);
      body = file.source.slice(bodyStart, bodyEnd);
    }

    components.push({
      file,
      name: match[2],
      params: match[3] ?? match[4] ?? '',
      body,
      bodyStart,
      bodyEnd,
      start: match.index,
      exported: Boolean(match[1]),
      exportName: match[2],
    });
  }

  return components;
};

const collectImports = (file, filesByPath) => {
  const imports = new Map();
  const pattern = /import\s+(?:type\s+)?([^'";]+?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = pattern.exec(file.source))) {
    const modulePath = resolveImportPath(file.absolutePath, match[2], filesByPath);
    if (!modulePath) continue;

    const clause = match[1].trim();
    const namedMatch = clause.match(/\{([^}]+)\}/);

    if (namedMatch) {
      for (const part of splitTopLevel(namedMatch[1], ',')) {
        const [imported, local = imported] = part.split(/\s+as\s+/).map((value) => value.trim());
        if (imported && local) {
          imports.set(local, { modulePath, exportName: imported });
        }
      }
    }

    const defaultMatch = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (defaultMatch && !clause.startsWith('{')) {
      imports.set(defaultMatch[1], { modulePath, exportName: 'default' });
    }
  }

  return imports;
};

const collectJsxElements = (component) => {
  const elements = [];
  const source = component.file.source;
  let index = component.bodyStart;

  while (index < component.bodyEnd) {
    const tagStart = source.indexOf('<', index);
    if (tagStart < 0 || tagStart >= component.bodyEnd) break;
    const next = source[tagStart + 1];

    if (next === '/' || next === '>' || next === '!' || next === '?' || next === undefined) {
      index = tagStart + 1;
      continue;
    }

    const nameMatch = source.slice(tagStart + 1).match(/^([A-Za-z][A-Za-z0-9]*)/);
    if (!nameMatch) {
      index = tagStart + 1;
      continue;
    }

    const tag = nameMatch[1];
    const attrStart = tagStart + 1 + tag.length;
    const tagEnd = findOpeningTagEnd(source, attrStart);
    if (tagEnd < 0 || tagEnd > component.bodyEnd) break;

    elements.push({
      tag,
      start: tagStart,
      end: tagEnd + 1,
      attributes: parseAttributes(source, attrStart, tagEnd),
    });
    index = tagEnd + 1;
  }

  return elements;
};

const parseAttributes = (source, start, end) => {
  const attributes = [];
  let index = start;

  while (index < end) {
    index = skipWhitespace(source, index);
    if (index >= end || source[index] === '/') break;

    const nameStart = index;
    while (index < end && /[A-Za-z0-9_$:-]/.test(source[index])) index += 1;
    const name = source.slice(nameStart, index);
    if (!name) {
      index += 1;
      continue;
    }

    index = skipWhitespace(source, index);
    let expression = null;
    let expressionStart = index;
    let expressionEnd = index;

    if (source[index] === '=') {
      index += 1;
      index = skipWhitespace(source, index);

      if (source[index] === '{') {
        const close = findMatching(source, index, '{', '}');
        expressionStart = index + 1;
        expressionEnd = close;
        expression = source.slice(expressionStart, expressionEnd).trim();
        index = close + 1;
      } else if (source[index] === '"' || source[index] === "'") {
        const quote = source[index];
        expressionStart = index + 1;
        index += 1;
        while (index < end && source[index] !== quote) index += 1;
        expressionEnd = index;
        expression = source.slice(expressionStart, expressionEnd);
        index += 1;
      }
    }

    attributes.push({
      name,
      expression,
      start: nameStart,
      end: index,
      expressionStart,
      expressionEnd,
    });
  }

  return attributes;
};

const collectPropBindings = (params) => {
  const bindings = new Map();
  const normalized = stripTypeAnnotation(params.trim());
  if (!normalized) return bindings;

  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    const inner = normalized.slice(1, -1);
    for (const part of splitTopLevel(inner, ',')) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const [left, right] = splitFirst(cleaned, ':');
      const prop = propertyName(left.trim());
      const bindingName = bindingIdentifierName((right ?? left).trim());
      if (prop && bindingName) bindings.set(bindingName, { kind: 'prop', prop });
    }
  } else if (/^[A-Za-z_$][\w$]*$/.test(normalized)) {
    bindings.set(normalized, { kind: 'propsObject' });
  }

  return bindings;
};

const propReference = (expression, propBindings) => {
  const value = stripExpressionWrappers(expression);
  if (!value) return null;

  if (/^[A-Za-z_$][\w$]*$/.test(value)) {
    const binding = propBindings.get(value);
    return binding?.kind === 'prop' ? binding.prop : null;
  }

  const member = value.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/);
  if (member) {
    const binding = propBindings.get(member[1]);
    return binding?.kind === 'propsObject' ? member[2] : null;
  }

  return null;
};

const resolveJsxTarget = (graph, file, tag) => {
  if (!tag) return { kind: 'unknown' };
  if (isHostJsxTag(tag)) return { kind: 'host', tag };

  const localComponent = graph.components.get(componentKey(file.absolutePath, tag));
  if (localComponent) {
    return {
      kind: 'component',
      componentName: localComponent.name,
      file: localComponent.file,
    };
  }

  const imported = graph.modules.get(file.absolutePath)?.imports.get(tag);
  if (imported) {
    const targetModule = graph.modules.get(imported.modulePath);
    const componentName = targetModule?.exports.get(imported.exportName) ?? imported.exportName;
    const component = graph.components.get(componentKey(imported.modulePath, componentName));
    if (component) {
      return {
        kind: 'component',
        componentName: component.name,
        file: component.file,
      };
    }
  }

  return { kind: 'component', componentName: tag, file: null };
};

const createEvidencePathFinderFromEdges = (edgesBySource, component, prop, seen) => {
  const seenKey = `${component}\u0000${prop}`;
  if (seen.has(seenKey)) return null;
  seen.add(seenKey);

  const edges = edgesBySource.get(component)?.get(prop) ?? [];
  for (const edge of edges) {
    if (edge.targetKind === 'host' && isHostEventAttribute(edge.targetTag, edge.targetProp)) {
      return [`${component}.${prop}`, `${edge.targetTag}.${edge.targetProp}`];
    }

    if (edge.targetKind === 'component' && edge.targetComponent) {
      const tail = createEvidencePathFinderFromEdges(edgesBySource, edge.targetComponent, edge.targetProp, seen);
      if (tail) return [`${component}.${prop}`, ...tail];
    }
  }

  return null;
};

const findEventEvidencePath = (edgesBySource, component, prop, seen) => {
  return createEvidencePathFinderFromEdges(edgesBySource, component, prop, seen);
};

const indexPropForwardingEdges = (edges) => {
  const edgesBySource = new Map();

  for (const edge of Array.isArray(edges) ? edges : []) {
    const component = String(edge?.component ?? '');
    const prop = String(edge?.prop ?? '');
    if (!component || !prop) continue;

    let propEdges = edgesBySource.get(component);
    if (!propEdges) {
      propEdges = new Map();
      edgesBySource.set(component, propEdges);
    }

    let sourceEdges = propEdges.get(prop);
    if (!sourceEdges) {
      sourceEdges = [];
      propEdges.set(prop, sourceEdges);
    }

    sourceEdges.push(edge);
  }

  return edgesBySource;
};

const resolveImportPath = (absolutePath, specifier, filesByPath) => {
  if (!specifier.startsWith('.')) return null;

  const base = path.resolve(path.dirname(absolutePath), specifier);
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];

  return candidates.find((candidate) => filesByPath.has(candidate)) ?? null;
};

const isClosureExpressionText = (expression) => {
  if (!expression) return false;
  const value = stripExpressionWrappers(expression);
  return value.includes('=>') || /^function\b/.test(value);
};

const closureValueKind = (expression) => {
  const value = stripExpressionWrappers(expression);
  if (value.includes('=>')) return 'ArrowFunctionExpression';
  if (/^function\b/.test(value)) return 'FunctionExpression';
  return 'Expression';
};

const stripExpressionWrappers = (expression) => {
  let value = String(expression ?? '').trim();
  while (value.startsWith('(') && value.endsWith(')') && findMatching(value, 0, '(', ')') === value.length - 1) {
    value = value.slice(1, -1).trim();
  }
  if (value.endsWith('!')) value = value.slice(0, -1).trim();
  return value;
};

const stripTypeAnnotation = (value) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    const close = findMatching(trimmed, 0, '{', '}');
    return close >= 0 ? trimmed.slice(0, close + 1) : trimmed;
  }
  return trimmed.replace(/\s*:\s*.+$/, '').trim();
};

const propertyName = (value) => {
  const trimmed = value.trim();
  return trimmed.replace(/^['"]|['"]$/g, '').replace(/\?.*$/, '').trim();
};

const bindingIdentifierName = (value) => {
  const trimmed = stripTypeAnnotation(value.replace(/=.*$/, '').trim());
  const match = trimmed.match(/[A-Za-z_$][\w$]*/);
  return match?.[0] ?? null;
};

const isHostJsxTag = (tag) => /^[a-z]/.test(tag);
const isComponentName = (name) => /^[A-Z]/.test(name);
const isHostEventAttribute = (tag, attribute) => isHostJsxTag(tag) && /^on[A-Z]/.test(attribute);
const componentKey = (absolutePath, name) => `${absolutePath}\u0000${name}`;
const boundaryKey = (component, prop) => `${component}\u0000${prop}`;
const normalizePath = (value) => value.split(path.sep).join('/');

const findOpeningTagEnd = (source, start) => {
  let braceDepth = 0;
  let quote = null;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const prev = source[index - 1];

    if (quote) {
      if (char === quote && prev !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') braceDepth += 1;
    else if (char === '}') braceDepth -= 1;
    else if (char === '>' && braceDepth === 0) return index;
  }

  return -1;
};

const findMatching = (source, start, open, close) => {
  let depth = 0;
  let quote = null;
  let template = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const prev = source[index - 1];

    if (template) {
      if (char === '`' && prev !== '\\') template = false;
      continue;
    }

    if (quote) {
      if (char === quote && prev !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '`') {
      template = true;
      continue;
    }

    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const findExpressionEnd = (source, start) => {
  let index = start;
  while (index < source.length && source[index] !== ';' && source[index] !== '\n') index += 1;
  return index;
};

const skipWhitespace = (source, start) => {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
};

const splitTopLevel = (value, separator) => {
  const parts = [];
  let start = 0;
  let braceDepth = 0;
  let parenDepth = 0;
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const prev = value[index - 1];

    if (quote) {
      if (char === quote && prev !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') braceDepth += 1;
    else if (char === '}') braceDepth -= 1;
    else if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth -= 1;
    else if (char === separator && braceDepth === 0 && parenDepth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
};

const splitFirst = (value, separator) => {
  const index = value.indexOf(separator);
  if (index < 0) return [value, null];
  return [value.slice(0, index), value.slice(index + separator.length)];
};

const locOf = (source, offset) => {
  const prefix = source.slice(0, offset);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: lines.at(-1).length,
  };
};

const sortJson = (value) => {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
  }
  return value;
};

const stableJsonInline = (value) => JSON.stringify(sortJson(value));

const sortBoundaryRecord = (left, right) => {
  const byComponent = left.component.localeCompare(right.component);
  return byComponent || left.prop.localeCompare(right.prop);
};

const sortEdge = (left, right) => {
  const byFile = left.sourceFile.localeCompare(right.sourceFile);
  const byComponent = byFile || left.component.localeCompare(right.component);
  return byComponent || left.span.start - right.span.start;
};

const sortByFileAndSpan = (left, right) => {
  const byFile = left.file.localeCompare(right.file);
  return byFile || left.span.start - right.span.start;
};
